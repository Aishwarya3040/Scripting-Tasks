/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */

/************************************************************************************************
 *  
 * OTP-9656: Custom form to store blood donor details and track them in database
 *
*************************************************************************************************
 *
 * Author: Jobin and Jismi IT Services
 *
 * Date Created : 1-November-2025
 *
 * Description : Suitelet script to collect blood donor details and store them in a custom record.
 *
 * REVISION HISTORY
 *
 * @version 1.2 : 11-November-2025 : Final formatting and naming convention fixes by JJ0416
 *
*************************************************************************************************/

define(['N/ui/serverWidget', 'N/record', 'N/log', 'N/search'], (serverWidget, record, log, search) => {

  /**
   * Handles incoming Suitelet requests and routes to appropriate logic.
   * @param {SuiteletContext} context - The Suitelet context object.
   */
  function onRequest(context) {
    try {
      if (context.request.method === 'GET') {
        renderDonorForm(context);
      } else {
        processDonorSubmission(context);
      }
    } catch (scriptError) {
        log.error({ title: 'Error in onRequest', details: scriptError });
    }
  }

  /**
   * Renders the blood donor registration form.
   * @param {SuiteletContext} context - The Suitelet context object.
   */
  function renderDonorForm(context) {
    try {
      const donorForm = serverWidget.createForm({ title: 'Blood Donor Registration Form' });

      donorForm.addField({
        id: 'custrecord_jj_fname_',
        type: serverWidget.FieldType.TEXT,
        label: 'First Name'
      }).isMandatory = true;

      donorForm.addField({
        id: 'custrecord_jj_lname_',
        type: serverWidget.FieldType.TEXT,
        label: 'Last Name'
      }).isMandatory = true;

      const genderField = donorForm.addField({
        id: 'custrecord_jj_gender_',
        type: serverWidget.FieldType.SELECT,
        label: 'Gender'
      });
      genderField.isMandatory = true;
      genderField.addSelectOption({ value: '', text: '' });
      genderField.addSelectOption({ value: '1', text: 'Female' });
      genderField.addSelectOption({ value: '2', text: 'Male' });
      genderField.addSelectOption({ value: '3', text: 'Others' });

      donorForm.addField({
        id: 'custrecord_jj_phone_number_',
        type: serverWidget.FieldType.PHONE,
        label: 'Phone Number'
      }).isMandatory = true;

      donorForm.addField({
        id: 'custrecord_jj_blood_group_',
        type: serverWidget.FieldType.TEXT,
        label: 'Blood Group'
      }).isMandatory = true;

      donorForm.addField({
        id: 'custrecord_jj_last_donation_date_',
        type: serverWidget.FieldType.DATE,
        label: 'Last Donation Date'
      }).isMandatory = true;

      donorForm.addSubmitButton({ label: 'Submit' });

      context.response.writePage(donorForm);
    } catch (formError) {
        log.error({ title: 'Error in renderDonorForm', details: formError });
    }
  }

  /**
   * Processes the submitted donor form and creates a custom record.
   * Prevents duplicate entries based on key donor fields.
   * @param {SuiteletContext} context - The Suitelet context object.
   */
  function processDonorSubmission(context) {
    try {
      const requestParameters = context.request.parameters;
      const submittedDateString = requestParameters['custrecord_jj_last_donation_date_'];
      const submittedDonationDate = new Date(submittedDateString);

      if (isNaN(submittedDonationDate.getTime())) {
        throw new Error('Invalid date format submitted.');
      }

      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);

      if (submittedDonationDate > todayDate) {
        throw new Error('Last Donation Date cannot be a future date.');
      }

      const donorFirstName = (requestParameters['custrecord_jj_fname_'] || '').trim().toLowerCase();
      const donorLastName = (requestParameters['custrecord_jj_lname_'] || '').trim().toLowerCase();
      const donorPhoneNumber = (requestParameters['custrecord_jj_phone_number_'] || '').trim();
      const donorBloodGroup = (requestParameters['custrecord_jj_blood_group_'] || '').trim().toUpperCase();

      const donorSearch = search.create({
        type: 'customrecord_jj_blood_donor_record',
        filters: [
          ['custrecord_jj_first_name', 'contains', donorFirstName],
          'AND',
          ['custrecord_jj_last_name', 'contains', donorLastName],
          'AND',
          ['custrecord_jj_phone_number', 'is', donorPhoneNumber],
          'AND',
          ['custrecord_jj_blood_group', 'is', donorBloodGroup]
        ],
        columns: ['internalid']
      });

      const existingDonorResults = donorSearch.run().getRange({ start: 0, end: 1 });

      if (existingDonorResults.length > 0) {
        throw new Error('Duplicate donor record detected. This donor is already registered.');
      }

      const donorRecord = record.create({
        type: 'customrecord_jj_blood_donor_record',
        isDynamic: true
      });

      donorRecord.setValue({
        fieldId: 'custrecord_jj_first_name',
        value: requestParameters['custrecord_jj_fname_'] || ''
      });

      donorRecord.setValue({
        fieldId: 'custrecord_jj_last_name',
        value: requestParameters['custrecord_jj_lname_'] || ''
      });

      donorRecord.setValue({
        fieldId: 'custrecord_jj_gender',
        value: requestParameters['custrecord_jj_gender_'] || ''
      });

      donorRecord.setValue({
        fieldId: 'custrecord_jj_phone_number',
        value: donorPhoneNumber
      });

      donorRecord.setValue({
        fieldId: 'custrecord_jj_blood_group',
        value: donorBloodGroup
      });

      donorRecord.setValue({
        fieldId: 'custrecord_jj_last_donation_date',
        value: submittedDonationDate
      });

      donorRecord.save();

      const confirmationForm = serverWidget.createForm({ title: 'Blood Donor Registration' });
      const confirmationField = confirmationForm.addField({
        id: 'custpage_confirmation_msg',
        type: serverWidget.FieldType.INLINEHTML,
        label: 'Confirmation'
      });
      confirmationField.defaultValue = '<div style="color:green;font-weight:bold;">Donor Registered Successfully.</div>';
      context.response.writePage(confirmationForm);

    } catch (submissionError) {
        log.error({ title: 'Error in processDonorSubmission', details: submissionError });

      const errorForm = serverWidget.createForm({ title: 'Error' });
      const errorField = errorForm.addField({
        id: 'custpage_error_msg',
        type: serverWidget.FieldType.INLINEHTML,
        label: 'Error'
      });
      errorField.defaultValue = '<div style="padding:10px;border:1px solid #d32f2f;background:#ffebee;color:#c62828;font-weight:600;">Save Failed: ' + submissionError.message + '</div>';
      context.response.writePage(errorForm);
    }
  }

  return {
    onRequest
  };
});
