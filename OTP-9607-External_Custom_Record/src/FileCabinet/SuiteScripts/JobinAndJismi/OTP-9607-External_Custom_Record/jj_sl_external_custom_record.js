/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
/************************************************************************************************
 *  
 * OTP-9607 : External Custom Record form and actions.
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
 
  /**
   * Builds and returns the customer inquiry form.
   * @returns {serverWidget.Form} The Suitelet form object
   */
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
 
      const customerSelectField = customerForm.addField({
        id: 'custpage_customer_ref',
        type: serverWidget.FieldType.SELECT,
        label: 'Link to Customer (optional)'
      });
      customerSelectField.addSelectOption({ value: '', text: '' });
 
      const customerSearch = search.create({
        type: search.Type.CUSTOMER,
        filters: [],
        columns: ['internalid', 'entityid']
      });
 
      customerSearch.run().each(function(customerResult) {
        const customerId = customerResult.getValue({ name: 'internalid' });
        const customerName = customerResult.getValue({ name: 'entityid' });
        customerSelectField.addSelectOption({ value: customerId, text: customerName });
        return true;
      });
 
      customerForm.addSubmitButton({ label: 'Submit Inquiry' });
      return customerForm;
    } catch (error) {
      log.error({ title: 'Error in buildInquiryForm', details: error });
      throw error;
    }
  }
 
  /**
   * Creates a new customer inquiry record and links it to a customer if matched by email.
   * @param {Object} formData - Form submission parameters
   * @param {string} formData.name - Customer name
   * @param {string} formData.email - Customer email
   * @param {string} formData.subject - Inquiry subject
   * @param {string} formData.message - Inquiry message
   * @param {string} [formData.customerRef] - Optional customer internal ID
   */
  function createInquiryRecord(formData) {
    try {
      let linkedCustomerId = formData.customerRef || null;
 
      if (!linkedCustomerId && formData.email) {
        try {
          const customerSearch = search.create({
            type: search.Type.CUSTOMER,
            filters: [['email', 'equalto', formData.email]],
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
        inquiryRecord.setValue({ fieldId: 'custrecord_jj_customer_ref', value: linkedCustomerId });
      }
 
      inquiryRecord.save();
    } catch (error) {
      log.error({ title: 'Error in createInquiryRecord', details: error });
      throw error;
    }
  }
 
  /**
   * Handles GET and POST requests to render the form or process submissions.
   * @param {Object} context - Suitelet context
   * @param {ServerRequest} context.request - Incoming request
   * @param {ServerResponse} context.response - Suitelet response
   */
  function onRequest(context) {
    try {
      if (context.request.method === 'GET') {
        try {
          const customerForm = buildInquiryForm();
          context.response.writePage(customerForm);
        } catch (formError) {
          log.error({ title: 'Error rendering form', details: formError });
          context.response.write('Unable to load the form. Please try again later.');
        }
      } else {
        try {
          const formData = {
            name: context.request.parameters.custpage_name,
            email: context.request.parameters.custpage_email,
            subject: context.request.parameters.custpage_subject,
            message: context.request.parameters.custpage_message,
            customerRef: context.request.parameters.custpage_customer_ref
          };
 
          createInquiryRecord(formData);
          context.response.write('Thank you! Your inquiry has been submitted.');
        } catch (submitError) {
          log.error({ title: 'Error submitting inquiry', details: submitError });
          context.response.write('An error occurred while submitting your inquiry. Please try again later.');
        }
      }
    } catch (outerError) {
      log.error({ title: 'Unhandled error in onRequest', details: outerError });
      context.response.write('Unexpected error occurred. Please contact support.');
    }
  }
 
  return {
    onRequest: onRequest
  };
});
 
 