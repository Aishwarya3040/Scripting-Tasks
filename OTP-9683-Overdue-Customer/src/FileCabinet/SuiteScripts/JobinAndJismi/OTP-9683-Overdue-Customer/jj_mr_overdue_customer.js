/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
/************************************************************************************************
 *  
 * OTP-9783 : Monthly Overdue Reminder for Customer
 *
*************************************************************************************************
 *
 * Author        : Jobin and Jismi IT Services
 *
 * Date Created  : 24-October-2025
 *
 * Description   : Map/Reduce script identifies overdue invoices, groups them by customer,
 *                 generates a CSV summary, and sends email notifications with the CSV attached.
 *
 * REVISION HISTORY
 *
 * @version 1.1 : 28-October-2025 : The initial build was created by JJ0416
 *
*************************************************************************************************/

define(['N/search', 'N/file', 'N/email', 'N/record'], (search, file, email, record) => {

    const fallbackSenderId = -5;

    /**
     * Creates a search to find overdue invoices.
     * @returns {Object} NetSuite search object
     */
    const createInvoiceSearch = () => {
        try {
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
                    search.createColumn({
                        name: 'formulanumeric',
                        formula: '{today} - {duedate}',
                        label: 'Days Overdue'
                    })
                ]
            });
        } catch (error) {
            log.error('createInvoiceSearch Error', error.message);
        }
    };

    /**
     * Retrieves customer email and sales rep details.
     * @param {string} customerId - Internal ID of the customer
     * @returns {Object} Object containing email and salesRepId
     */
    const getCustomerEmailAndSalesRep = (customerId) => {
        try {
            const customerRecord = record.load({
                type: record.Type.CUSTOMER,
                id: customerId
            });

            const isInactive = customerRecord.getValue('isinactive');
            if (isInactive === true) {
                log.audit('Inactive Customer', `Customer ${customerId} is inactive`);
                return { email: null, salesRepId: fallbackSenderId };
            }

            const emailAddress = customerRecord.getValue('email');
            if (!emailAddress) {
                log.audit('Missing Email', `Customer ${customerId} has no email`);
                return { email: null, salesRepId: fallbackSenderId };
            }

            const salesRepId = customerRecord.getValue('salesrep');
            if (!salesRepId) {
                return { email: emailAddress, salesRepId: fallbackSenderId };
            }

            try {
                const employeeRecord = record.load({
                    type: record.Type.EMPLOYEE,
                    id: salesRepId
                });

                const isRepInactive = employeeRecord.getValue('isinactive');
                if (isRepInactive === true) {
                    log.audit('Inactive Sales Rep', `Sales Rep ${salesRepId} is inactive`);
                    return { email: emailAddress, salesRepId: fallbackSenderId };
                }

                return { email: emailAddress, salesRepId };
            } catch (repError) {
                log.error('Sales Rep Load Error', repError.message);
                return { email: emailAddress, salesRepId: fallbackSenderId };
            }

        } catch (error) {
            log.error('getCustomerEmailAndSalesRep Error', error.message);
            return { email: null, salesRepId: fallbackSenderId };
        }
    };

    /**
     * Generates a CSV file containing overdue invoice details.
     * @param {string} customerName - Customer name
     * @param {Array} invoiceList - List of invoice objects
     * @param {string} customerEmail - Customer email address
     * @returns {Object} NetSuite file object
     */
    const generateCsvFile = (customerName, invoiceList, customerEmail) => {
        try {
            const csvLines = ['Customer Name,Customer Email,Invoice Number,Invoice Amount,Due Date,Days Overdue'];
            invoiceList.forEach(invoice => {
                csvLines.push(`${invoice.customerName},${customerEmail},${invoice.invoiceNumber},${invoice.invoiceAmount},${invoice.dueDate},${invoice.daysOverdue.toFixed(0)}`);
            });

            const csvFile = file.create({
                name: `Overdue_Invoices_${customerName}.csv`,
                fileType: file.Type.CSV,
                contents: csvLines.join('\n'),
                folder: 409
            });

            csvFile.save();
            return csvFile;
        } catch (error) {
            log.error('generateCsvFile Error', error.message);
        }
    };

    /**
     * Sends an email with the CSV file attached.
     * @param {string} salesRepId - Sales Rep ID
     * @param {string} customerId - Customer ID
     * @param {string} customerName - Customer name
     * @param {Object} csvFile - NetSuite file object
     * @param {string} customerEmail - Customer email address
     */
    const sendEmailWithCsv = (salesRepId, customerId, customerName, csvFile, customerEmail) => {
        try {
            let authorId = fallbackSenderId;
            if (salesRepId && salesRepId !== fallbackSenderId) {
                try {
                    const employeeRecord = record.load({
                        type: record.Type.EMPLOYEE,
                        id: salesRepId
                    });
                    const isRepInactive = employeeRecord.getValue('isinactive');
                    if (!isRepInactive) {
                        authorId = salesRepId;
                    } else {
                        log.audit('Inactive Sales Rep', `Sales Rep ${salesRepId} is inactive, fallback used`);
                    }
                } catch (err) {
                    log.error('Sales Rep Validation Error', err.message);
                }
            }

            if (!customerEmail) {
                log.audit('Skipping Email', `Customer ${customerId} has no email; email not sent.`);
                return;
            }

            email.send({
                author: authorId,
                recipients: [customerEmail],
                subject: 'Monthly Overdue Invoice Notification',
                body: `Dear ${customerName},\n\nPlease find attached your overdue invoices as of last month.\n\nRegards,\nFinance Team`,
                attachments: [csvFile]
            });
            log.audit('Email Sent', `Author: ${authorId}, Customer: ${customerName} (${customerEmail})`);
        } catch (error) {
            log.error('sendEmailWithCsv Error', error.message);
        }
    };

    /**
     * Provides input data for the Map/Reduce script.
     * @returns {Object} NetSuite search object
     */
    const getInputData = () => {
        try {
            return createInvoiceSearch();
        } catch (error) {
            log.error('getInputData Error', error.message);
        }
    };

    /**
     * Map stage: Processes each invoice record.
     * @param {Object} context - Map context
     */
    const map = (context) => {
        try {
            const result = JSON.parse(context.value);
            const invoice = result.values;

            const customerId = invoice.entity.value;
            const invoiceDetails = {
                invoiceId: result.id,
                invoiceNumber: invoice.tranid,
                invoiceAmount: invoice.amount,
                dueDate: invoice.duedate,
                daysOverdue: parseFloat(invoice.formulanumeric),
                customerName: invoice.entity.text
            };

            context.write({
                key: customerId,
                value: invoiceDetails
            });
        } catch (error) {
            log.error('map Error', error.message);
        }
    };

    /**
     * Reduce stage: Groups invoices by customer and sends emails.
     * @param {Object} context - Reduce context
     */
    const reduce = (context) => {
        try {
            const customerId = context.key;
            const invoiceList = context.values.map(JSON.parse);
            const customerName = invoiceList[0].customerName;

            const { email: customerEmail, salesRepId } = getCustomerEmailAndSalesRep(customerId);
            if (!customerEmail) {
                log.audit('Skipping Email', `Customer ${customerId} skipped due to missing email or inactive status`);
                return;
            }

            const csvFile = generateCsvFile(customerName, invoiceList, customerEmail);
            sendEmailWithCsv(salesRepId, customerId, customerName, csvFile, customerEmail);
        } catch (error) {
            log.error('reduce Error', error.message);
        }
    };

    return { getInputData, map, reduce };
});
