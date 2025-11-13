/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
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
 * Description : Suitelet and UserEvent scripts enable external users to submit customer queries directly into NetSuite without login access.
 *
 * REVISION HISTORY
 *
 * @version 1.0 : 28-October-2025 :  The initial build was created by JJ0416
 *
*************************************************************************************************/

define(['N/ui/serverWidget', 'N/record', 'N/search', 'N/log'], function(serverWidget, record, search, log) {

  function buildInquiryForm() {
    try {
      const customerForm = serverWidget.createForm({ title: 'Customer Inquiry Form' });

      customerForm.addField({
        id: 'custpage_name',
        type: serverWidget.FieldType.TEXT,
        label: 'Customer Name'
      }).isMandatory = true;

      customerForm.addField({
        id: 'custpage_email',
        type: serverWidget.FieldType.EMAIL,
        label: 'Customer Email'
      }).isMandatory = true;

      customerForm.addField({
        id: 'custpage_subject',
        type: serverWidget.FieldType.TEXT,
        label: 'Subject'
      }).isMandatory = true;

      customerForm.addField({
        id: 'custpage_message',
        type: serverWidget.FieldType.TEXTAREA,
        label: 'Message'
      }).isMandatory = true;

      customerForm.addSubmitButton({ label: 'Submit Inquiry' });
      return customerForm;
    } catch (error) {
      log.error({ title: 'Error in buildInquiryForm', details: error });
      throw error;
    }
  }

  function isDuplicateInquiry(email) {
    try {
      const normalizedEmail = email ? email.trim().toLowerCase() : '';
      const inquirySearch = search.create({
        type: 'customrecord_jj_customerinquiry',
        filters: [['custrecord_jj_customer_email', 'is', normalizedEmail]],
        columns: ['internalid']
      });

      const results = inquirySearch.run().getRange({ start: 0, end: 1 });
      return results.length > 0;
    } catch (error) {
      log.error({ title: 'Error in isDuplicateInquiry', details: error });
      return false;
    }
  }

  function createInquiryRecord(formData) {
    try {
      let linkedCustomerId = null;

      if (formData.email) {
        try {
          const normalizedEmail = formData.email.trim().toLowerCase();

          const customerSearch = search.create({
            type: search.Type.CUSTOMER,
            filters: [['email', 'is', normalizedEmail]],
            columns: ['internalid']
          });

          customerSearch.run().each(function(customerResult) {
            linkedCustomerId = customerResult.getValue({ name: 'internalid' });
            return false;
          });

        } catch (searchError) {
          log.error({ title: 'Error in customer email search', details: searchError });
        }
      }

      const inquiryRecord = record.create({
        type: 'customrecord_jj_customerinquiry',
        isDynamic: true
      });

      inquiryRecord.setValue({ fieldId: 'custrecord_jj_customername', value: formData.name });
      inquiryRecord.setValue({ fieldId: 'custrecord_jj_customer_email', value: formData.email });
      inquiryRecord.setValue({ fieldId: 'custrecord_jj_subject', value: formData.subject });
      inquiryRecord.setValue({ fieldId: 'custrecord_jj_message', value: formData.message });

      if (linkedCustomerId) {
        inquiryRecord.setValue({ fieldId: 'custrecord_jj_customer', value: linkedCustomerId });
      }

      inquiryRecord.save();
    } catch (error) {
      log.error({ title: 'Error in createInquiryRecord', details: error });
      throw error;
    }
  }

  function onRequest(context) {
    try {
      if (context.request.method === 'GET') {
        const customerForm = buildInquiryForm();
        context.response.writePage(customerForm);
      } else {
        const formData = {
          name: context.request.parameters.custpage_name,
          email: context.request.parameters.custpage_email,
          subject: context.request.parameters.custpage_subject,
          message: context.request.parameters.custpage_message
        };

        if (isDuplicateInquiry(formData.email)) {
          context.response.write('An inquiry with this email already exists. Please wait for a response or contact support.');
          return;
        }

        createInquiryRecord(formData);
        context.response.write('Thank you! Your inquiry has been submitted.');
      }
    } catch (error) {
      log.error({ title: 'Unhandled error in onRequest', details: error });
      context.response.write('Unexpected error occurred. Please contact support.');
    }
  }

  return {
    onRequest: onRequest
  };
});
