/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
/************************************************************************************************
 * OTP-9607 : External Custom Record form and actions
 * Author: Jobin and Jismi IT Services
 * Date Created : 29-October-2025
 * Description : Sends notifications when a customer inquiry is submitted.
 *************************************************************************************************/

define(['N/record', 'N/email', 'N/log'], function(record, email, log) {

  const ADMIN_ID = -5; // Admin/System user

  /**
   * Sends email notifications to recipients
   */
  function sendInquiryEmail(recipientIds, customerName, customerEmail, inquirySubject, inquiryMessage) {
    log.debug({
      title: 'Email Debug',
      details: `Author: ${ADMIN_ID}, Recipients: ${recipientIds}`
    });

    recipientIds.forEach(function(recipientId) {
      try {
        email.send({
          author: ADMIN_ID, // Admin as author
          recipients: recipientId,
          subject: 'New Customer Inquiry',
          body:
            `Dear Recipient,\n\nA new customer inquiry has been submitted.\n\n` +
            `Name: ${customerName}\n` +
            `Email: ${customerEmail}\n` +
            `Subject: ${inquirySubject}\n` +
            `Message: ${inquiryMessage}\n\n` +
            `Please review the inquiry in NetSuite.\n\nBest regards,\nNetSuite Automation`
        });

        log.debug({
          title: 'Email Sent',
          details: `Inquiry from ${customerName} (${customerEmail}) emailed to Employee ID: ${recipientId}`
        });
      } catch (emailError) {
        log.error({
          title: `Email Error for recipient ID ${recipientId}`,
          details: JSON.stringify(emailError)
        });
      }
    });
  }

  /**
   * After Submit Event
   */
  function afterSubmit(context) {
    try {
      if (context.type !== context.UserEventType.CREATE) return;

      const inquiryRecord = context.newRecord;
      const customerEmail = inquiryRecord.getValue('custrecord_jj_customer_email');
      const customerName = inquiryRecord.getValue('custrecord_jj_customername');
      const inquirySubject = inquiryRecord.getValue('custrecord_jj_subject');
      const inquiryMessage = inquiryRecord.getValue('custrecord_jj_message');

      if (!customerEmail) {
        log.debug({
          title: 'No Email Provided',
          details: 'Skipping email notifications.'
        });
        return;
      }

      // Default recipient is Admin
      const recipientIds = [ADMIN_ID];

      // Add Sales Rep if linked customer exists
      const existingCustomerRef = inquiryRecord.getValue('custrecord_jj_customer');
      if (existingCustomerRef) {
        try {
          const customerRecord = record.load({
            type: record.Type.CUSTOMER,
            id: existingCustomerRef
          });
          const salesRepId = customerRecord.getValue('salesrep');

          if (salesRepId && salesRepId !== ADMIN_ID) {
            recipientIds.push(salesRepId);
            log.debug({
              title: 'Sales Rep Found',
              details: `Sales Rep ID: ${salesRepId}`
            });
          }
        } catch (loadError) {
          log.error({
            title: 'Error loading linked customer',
            details: JSON.stringify(loadError)
          });
        }
      }

      // Send email
      sendInquiryEmail(recipientIds, customerName, customerEmail, inquirySubject, inquiryMessage);

    } catch (error) {
      log.error({
        title: 'Error in afterSubmit',
        details: JSON.stringify(error)
      });
    }
  }

  return { afterSubmit };
});