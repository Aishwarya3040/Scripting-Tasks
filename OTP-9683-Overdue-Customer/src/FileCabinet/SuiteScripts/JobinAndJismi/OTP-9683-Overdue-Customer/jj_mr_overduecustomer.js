/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */

/************************************************************************************************
 *  
 * OTP-9683 : Monthly Over Due Reminder for Customer
 *
*************************************************************************************************
 *
 * Author: Jobin and Jismi IT Services
 *
 * Date Created : 1-November-2025
 *
 * Description : Map/Reduce script to identify overdue invoices, generate CSV summaries, and email customers.
 *
 * REVISION HISTORY
 *
 * @version 1.0 : 11-November-2025 : Initial build created by JJ0416
 *
*************************************************************************************************/

define(['N/search', 'N/log', 'N/file', 'N/email', 'N/record'], function(search, log, file, email, record) {

  /**
   * Creates a saved search to find overdue invoices from last month.
   * @returns {Search} The invoice search object.
   */
  const createInvoiceSearch = () => {
    return search.create({
      type: search.Type.INVOICE,
      filters: [
        ['duedate', 'onorbefore', 'lastmonth'],
        'AND',
        ['status', 'anyof', ['CustInvc:A']],
        'AND',
        ['mainline', 'is', 'T']
      ],
      columns: [
        'internalid',
        'tranid',
        'entity',
        'amount',
        'duedate',
        'salesrep',
        search.createColumn({
          name: 'formulanumeric',
          formula: '{today} - {duedate}',
          label: 'Days Overdue'
        })
      ]
    });
  };

  /**
   * Logs each result from the invoice search for debugging.
   * @param {Search} searchObj - The search object containing invoice results.
   */
  const logSearchResults = (searchObj) => {
    try {
      searchObj.run().each(result => {
        const customerName = result.getText('entity');
        const invoiceNumber = result.getValue('tranid');
        const amount = result.getValue('amount');
        const dueDate = result.getValue('duedate');
        const daysOverdue = result.getValue({
          name: 'formulanumeric',
          formula: '{today} - {duedate}'
        });

        log.debug('Search Result', `Customer: ${customerName}, Invoice: ${invoiceNumber}, Amount: ${amount}, Due: ${dueDate}, Days Overdue: ${daysOverdue}`);
        return true;
      });
    } catch (error) {
      log.error({ title: 'Error in logSearchResults', details: error.message || error.toString() });
    }
  };

  /**
   * Retrieves the email address of a customer.
   * @param {number} customerId - Internal ID of the customer.
   * @returns {string|null} Email address or null if not found.
   */
  const getCustomerEmail = (customerId) => {
    try {
      return record.load({
        type: record.Type.CUSTOMER,
        id: customerId
      }).getValue('email');
    } catch (error) {
      log.error({ title: 'Customer Email Lookup Error', details: error.message || error.toString() });
      return null;
    }
  };

  /**
   * Creates a CSV file summarizing overdue invoices for a customer.
   * @param {string} customerName - Name of the customer.
   * @param {Array} invoices - Array of invoice summary objects.
   * @param {string} customerEmail - Email address of the customer.
   * @returns {File} The created CSV file object.
   */
  const createCsvFile = (customerName, invoices, customerEmail) => {
    try {
      const csvContent = ['Customer Name, Customer Email,Invoice Number,Invoice Amount,Due Date,Days Overdue'];
      invoices.forEach(inv => {
        csvContent.push(`${inv.customerName},${customerEmail},${inv.invoiceNumber},${inv.invoiceAmount},${inv.dueDate},${inv.daysOverdue.toFixed(0)}`);
      });

      const csvFile = file.create({
        name: `Overdue_Invoices_${customerName}.csv`,
        fileType: file.Type.CSV,
        contents: csvContent.join('\n'),
        folder: 409
      });

      csvFile.save();
      return csvFile;
    } catch (error) {
      log.error({ title: 'Error in createCsvFile', details: error.message || error.toString() });
      return null;
    }
  };

  /**
   * Sends an email with the CSV attachment to the customer.
   * @param {number} senderId - Internal ID of the sender (sales rep or fallback).
   * @param {number} customerId - Internal ID of the customer.
   * @param {string} customerName - Name of the customer.
   * @param {File} csvFile - CSV file object to attach.
   * @param {string} customerEmail - Email address of the customer.
   */
  const sendEmailWithAttachment = (senderId, customerId, customerName, csvFile, customerEmail) => {
    try {
      email.send({
        author: senderId,
        recipients: customerId,
        subject: 'Monthly Overdue Invoice Notification',
        body: `Dear ${customerName},\n\nPlease find attached your overdue invoices as of last month.\n\nRegards,\nFinance Team`,
        attachments: [csvFile]
      });

      log.audit('Email Sent', `Email sent to ${customerName} (${customerEmail}) from sender ID ${senderId}.`);
    } catch (error) {
      log.error({ title: 'Email Send Failed', details: `Customer: ${customerName}, Error: ${error.message || error.toString()}` });
    }
  };

  /**
   * Defines the input data for the Map/Reduce process.
   * @returns {Search} The invoice search object.
   */
  const getInputData = () => {
    try {
      log.debug('getInputData', 'Starting overdue invoice search');
      const searchObj = createInvoiceSearch();
      logSearchResults(searchObj);
      return searchObj;
    } catch (error) {
      log.error({ title: 'getInputData Error', details: error.message || error.toString() });
      throw error;
    }
  };

  /**
   * Maps each invoice to its customer for grouping.
   * @param {MapContext} scriptContext - The map context object.
   */
  const map = (scriptContext) => {
    try {
      const result = JSON.parse(scriptContext.value);
      const invoiceData = result.values;

      const customerId = invoiceData.entity.value;
      const invoiceSummary = {
        invoiceId: result.id,
        invoiceNumber: invoiceData.tranid,
        invoiceAmount: invoiceData.amount,
        dueDate: invoiceData.duedate,
        daysOverdue: parseFloat(invoiceData.formulanumeric),
        customerName: invoiceData.entity.text,
        salesRep: invoiceData.salesrep ? invoiceData.salesrep.value : null
      };

      scriptContext.write({
        key: customerId,
        value: invoiceSummary
      });
    } catch (error) {
      log.error({ title: 'Map Error', details: error.message || error.toString() });
    }
  };

  /**
   * Reduces grouped invoices per customer and sends email notifications.
   * @param {ReduceContext} scriptContext - The reduce context object.
   */
  const reduce = (scriptContext) => {
    try {
      const customerId = scriptContext.key;
      const invoices = scriptContext.values.map(JSON.parse);
      const customerName = invoices[0].customerName;
      const salesRepId = invoices[0].salesRep;
      const fallbackSenderId = -5;

      const customerEmail = getCustomerEmail(customerId);
      if (!customerEmail) {
        log.error({ title: 'Missing Email', details: `Customer ${customerName} (${customerId}) has no email` });
        return;
      }

      const csvFile = createCsvFile(customerName, invoices, customerEmail);
      if (!csvFile) return;

      const senderId = salesRepId || fallbackSenderId;
      sendEmailWithAttachment(senderId, customerId, customerName, csvFile, customerEmail);
    } catch (error) {
      log.error({ title: 'Reduce Error', details: error.message || error.toString() });
    }
  };

  return {
    getInputData: getInputData,
    map: map,
    reduce: reduce
  };
});
