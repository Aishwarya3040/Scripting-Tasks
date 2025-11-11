/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
 
/************************************************************************************************
 *  
 * OTP-9607 : External Custom Record form and actions
 *
*************************************************************************************************
 *
 * Author: Jobin and Jismi IT Services
 *
 * Date Created : 28-October-2025
 *
 * Description : Suitelet and UserEvent scripts enable external users to submit customer queries directly into NetSuite without login access.
 *
 * REVISION HISTORY
 *
 * @version 1.0 : 28-October-2025 :  The initial build was created by JJ0416
 *
*************************************************************************************************/
define(['N/record', 'N/search', 'N/email', 'N/runtime', 'N/log'], function(record, search, email, runtime, log) {
  const ADMIN_ID = -5;
 
  /**
   * Searches for a customer record by email address.
   * @param {string} customerEmail - The email address to search for.
   * @returns {search.Result|null} The matching customer search result or null if not found.
   */
  function findCustomerByEmail(customerEmail) {
    try {
      const customerSearch = search.create({
        type: search.Type.CUSTOMER,
        filters: [['email', 'equalto', customerEmail]],
        columns: ['internalid', 'salesrep']
      });
 
      const searchResult = customerSearch.run().getRange({ start: 0, end: 1 });
      return searchResult.length > 0 ? searchResult[0] : null;
    } catch (error) {
      log.error({ title: 'Error in findCustomerByEmail', details: error });
      return null;
    }
  }
 
  /**
   * Links a customer to the inquiry record.
   * @param {number} inquiryId - The internal ID of the inquiry record.
   * @param {number} matchedCustomerId - The internal ID of the customer to link.
   */
  function linkCustomerToInquiry(inquiryId, matchedCustomerId) {
    try {
      const inquiryRecord = record.load({
        type: 'customrecord_jj_customerinquiry',
        id: inquiryId,
        isDynamic: true
      });
 
      inquiryRecord.setValue({
        fieldId: 'custrecord_jj_customer_ref',
        value: matchedCustomerId
      });
 
      inquiryRecord.save();
 
      log.debug({
        title: 'Customer Linked',
        details: 'Customer ID ' + matchedCustomerId + ' linked to Inquiry ID ' + inquiryId
      });
    } catch (error) {
      log.error({ title: 'Error in linkCustomerToInquiry', details: error });
    }
  }
 
  /**
   * Sends an email notification to the system administrator.
   * @param {string} customerName - Customer name.
   * @param {string} customerEmail - Customer email.
   * @param {string} inquirySubject - Inquiry subject.
   * @param {string} inquiryMessage - Inquiry message.
   */
  function notifyAdmin(customerName, customerEmail, inquirySubject, inquiryMessage) {
    try {
      email.send({
        author: runtime.getCurrentUser().id,
        recipients: ADMIN_ID,
        subject: 'New Customer Inquiry',
        body: 'Dear Admin,\n\nA new customer inquiry has been submitted.\n\nDetails:\n' +
              'Name: ' + customerName + '\n' +
              'Email: ' + customerEmail + '\n' +
              'Subject: ' + inquirySubject + '\n' +
              'Message: ' + inquiryMessage + '\n\n' +
              'Please review the inquiry in NetSuite.\n\nBest regards,\nNetSuite Automation'
      });
 
      log.debug({
        title: 'Email Sent to Admin',
        details: 'Inquiry from ' + customerName + ' (' + customerEmail + ') was emailed to Admin with subject: ' + inquirySubject
      });
    } catch (error) {
      log.error({ title: 'Error in notifyAdmin', details: error });
    }
  }
 
  /**
   * Sends an email notification to the assigned sales representative.
   * @param {number} assignedSalesRepId - Internal ID of the sales representative.
   * @param {string} customerName - Customer name.
   * @param {string} customerEmail - Customer email.
   * @param {string} inquirySubject - Inquiry subject.
   * @param {string} inquiryMessage - Inquiry message.
   */
  function notifySalesRep(assignedSalesRepId, customerName, customerEmail, inquirySubject, inquiryMessage) {
    try {
      email.send({
        author: runtime.getCurrentUser().id,
        recipients: assignedSalesRepId,
        subject: 'New Customer Inquiry',
        body: 'Dear Sales Representative,\n\nYour customer (' + customerName + ', ' + customerEmail + ') has submitted a new inquiry.\n\n' +
              'Subject: ' + inquirySubject + '\n' +
              'Message: ' + inquiryMessage + '\n\n' +
              'Please follow up accordingly.\n\nWarm regards,\nNetSuite Automation'
      });
 
      log.debug({
        title: 'Email Sent to Sales Rep',
        details: 'Inquiry from ' + customerName + ' (' + customerEmail + ') was emailed to Sales Rep ID: ' + assignedSalesRepId
      });
    } catch (error) {
      log.error({ title: 'Error in notifySalesRep', details: error });
    }
  }
 
  /**
   * Executes after a new inquiry record is submitted.
   * Links the inquiry to a customer if matched by email and sends notifications.
   * @param {UserEventContext} context - The user event context object.
   */
  function afterSubmit(context) {
    try {
      if (context.type !== context.UserEventType.CREATE) return;
 
      try {
        const inquiryRecord = context.newRecord;
        const customerEmail = inquiryRecord.getValue({ fieldId: 'custrecord_jj_customer_email' });
        const customerName = inquiryRecord.getValue({ fieldId: 'custrecord_jj_customername' });
        const inquirySubject = inquiryRecord.getValue({ fieldId: 'custrecord_jj_subject' });
        const inquiryMessage = inquiryRecord.getValue({ fieldId: 'custrecord_jj_message' });
 
        if (!customerEmail) {
          log.debug({ title: 'No Email Provided', details: 'Skipping customer lookup and email notifications.' });
          return;
        }
 
        notifyAdmin(customerName, customerEmail, inquirySubject, inquiryMessage);
 
        const existingCustomerRef = inquiryRecord.getValue({ fieldId: 'custrecord_jj_customer_ref' });
 
        if (!existingCustomerRef) {
          const matchedCustomer = findCustomerByEmail(customerEmail);
 
          if (matchedCustomer) {
            const matchedCustomerId = matchedCustomer.getValue({ name: 'internalid' });
            const assignedSalesRepId = matchedCustomer.getValue({ name: 'salesrep' });
 
            linkCustomerToInquiry(inquiryRecord.id, matchedCustomerId);
 
            if (assignedSalesRepId) {
              notifySalesRep(assignedSalesRepId, customerName, customerEmail, inquirySubject, inquiryMessage);
            } else {
              log.debug({
                title: 'No Sales Rep Assigned',
                details: 'Customer ID ' + matchedCustomerId + ' has no Sales Rep.'
              });
            }
          } else {
            log.debug({
              title: 'Customer Not Found',
              details: 'No matching customer found for email: ' + customerEmail
            });
          }
        } else {
          log.debug({
            title: 'Customer Already Linked',
            details: 'Inquiry already linked to Customer ID: ' + existingCustomerRef
          });
        }
      } catch (innerError) {
        log.error({ title: 'Error in afterSubmit logic', details: innerError });
      }
    } catch (outerError) {
      log.error({ title: 'Error in afterSubmit wrapper', details: outerError });
    }
  }
 
  return {
    afterSubmit: afterSubmit
  };
});
 
 