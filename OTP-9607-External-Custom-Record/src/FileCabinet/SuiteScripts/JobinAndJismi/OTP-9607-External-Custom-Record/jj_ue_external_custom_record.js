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
 * Date Created : 29-October-2025
 *
 * Description : UserEvent script prevents duplicate inquiries, links customers, and sends notifications.
 *
 * REVISION HISTORY
 *
 * @version 1.0 : 28-October-2025 :  The initial build was created by JJ0416
 *
*************************************************************************************************/
define(['N/record', 'N/search', 'N/email', 'N/log'], function(record, search, email, log) {
  const ADMIN_ID = -5; // static Admin recipient
  const ADMIN_AUTHOR_ID = -5; // Admin is also the author
  /**
   * Sends an email notification to the system administrator.
   */
  function notifyAdmin(name, emailAddr, subject, message) {
    try {
      email.send({
        author: ADMIN_AUTHOR_ID,
        recipients: ADMIN_ID,
        subject: 'ENQUIRY',
        body: 'Name: ' + name + '\n' +
              'Email: ' + emailAddr + '\n' +
              'Subject: ' + subject + '\n' +
              'Message: ' + message
      });
      log.debug({ title: 'Email Sent to Admin', details: 'Inquiry emailed to Admin' });
    } catch (error) {
      log.error({ title: 'Error in notifyAdmin', details: error });
    }
  }
  /**
   * Sends an email notification to the assigned sales representative.
   */
  function notifySalesRep(salesRepId, name, emailAddr, subject, message) {
    try {
      if (!salesRepId) return;
      email.send({
        author: ADMIN_AUTHOR_ID,
        recipients: salesRepId,
        subject: 'ENQUIRY',
        body: 'Name: ' + name + '\n' +
              'Email: ' + emailAddr + '\n' +
              'Subject: ' + subject + '\n' +
              'Message: ' + message
      });
      log.debug({ title: 'Email Sent to Sales Rep', details: 'Inquiry emailed to Sales Rep ID: ' + salesRepId });
    } catch (error) {
      log.error({ title: 'Error in notifySalesRep', details: error });
    }
  }
  /**
   * Executes after a new inquiry record is submitted.
   */
  function afterSubmit(context) {
    try {
      if (context.type !== context.UserEventType.CREATE) return;
      const rec = context.newRecord;
      const name = rec.getValue({ fieldId: 'custrecord_jj_customername' });
      const emailAddr = rec.getValue({ fieldId: 'custrecord_jj_customer_email' });
      const subject = rec.getValue({ fieldId: 'custrecord_jj_subject' });
      const message = rec.getValue({ fieldId: 'custrecord_jj_message' });
      const customerId = rec.getValue({ fieldId: 'custrecord_jj_customer' });
      // Always notify Admin
      notifyAdmin(name, emailAddr, subject, message);
      // Notify Sales Rep if exists
      if (customerId) {
        const custRec = record.load({ type: record.Type.CUSTOMER, id: customerId });
        const salesRepId = custRec.getValue({ fieldId: 'salesrep' });
        if (salesRepId) {
          notifySalesRep(salesRepId, name, emailAddr, subject, message);
        }
      }
    } catch (error) {
      log.error({ title: 'Error in afterSubmit', details: error });
    }
  }
  return { afterSubmit: afterSubmit };
});
 