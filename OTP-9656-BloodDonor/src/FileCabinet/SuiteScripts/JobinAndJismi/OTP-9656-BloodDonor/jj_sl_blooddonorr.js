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
 * Date Created : 11-November-2025
 *
 * Description : Suitelet script to collect blood donor details and store them in a custom record.
 *
 * REVISION HISTORY
 *
 * @version 1.0 : 11-November-2025 : Initial build created by JJ0416
 *
*************************************************************************************************/

define(['N/ui/serverWidget', 'N/record', 'N/log'], function(serverWidget, record, log) {

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
    } catch (error) {
      log.error({ title: 'Error in onRequest', details: error });
    }
  }

  /**
   * Renders the blood donor registration form.
   * @param {SuiteletContext} context - The Suitelet context object.
   */
  function renderDonorForm(context) {
    try {
      const form = serverWidget.createForm({ title: 'Blood Donor Registration Form' });

      form.addField({
        id: 'custrecord_jj_fname_',
        type: serverWidget.FieldType.TEXT,
        label: 'First Name'
      }).isMandatory = true;

      form.addField({
        id: 'custrecord_jj_lname_',
        type: serverWidget.FieldType.TEXT,
        label: 'Last Name'
      }).isMandatory = true;

      const genderField = form.addField({
        id: 'custrecord_jj_gender_',
        type: serverWidget.FieldType.SELECT,
        label: 'Gender'
      });
      genderField.isMandatory = true;
      genderField.addSelectOption({ value: '', text: '' });
      genderField.addSelectOption({ value: '1', text: 'Female' });
      genderField.addSelectOption({ value: '2', text: 'Male' });
      genderField.addSelectOption({ value: '3', text: 'Others' });

      form.addField({
        id: 'custrecord_jj_phone_number_',
        type: serverWidget.FieldType.PHONE,
        label: 'Phone Number'
      }).isMandatory = true;

      form.addField({
        id: 'custrecord_jj_blood_group_',
        type: serverWidget.FieldType.TEXT,
        label: 'Blood Group'
      }).isMandatory = true;

      form.addField({
        id: 'custrecord_jj_last_donation_date_',
        type: serverWidget.FieldType.DATE,
        label: 'Last Donation Date'
      }).isMandatory = true;

      form.addSubmitButton({ label: 'Submit' });

      context.response.writePage(form);
    } catch (error) {
      log.error({ title: 'Error in renderDonorForm', details: error });
    }
  }

  /**
   * Processes the submitted donor form and creates a custom record.
   * @param {SuiteletContext} context - The Suitelet context object.
   */
  function processDonorSubmission(context) {
    try {
      const params = context.request.parameters;
      const rawDate = params['custrecord_jj_last_donation_date_'];
      const donationDate = new Date(rawDate);

      if (isNaN(donationDate.getTime())) {
        throw new Error('Invalid date format submitted.');
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (donationDate > today) {
        throw new Error('Last Donation Date cannot be a future date.');
      }

      const donorRecord = record.create({
        type: 'customrecord_jj_blood_donor_record',
        isDynamic: true
      });

      donorRecord.setValue({
        fieldId: 'custrecord_jj_first_name',
        value: params['custrecord_jj_fname_'] || ''
      });

      donorRecord.setValue({
        fieldId: 'custrecord_jj_last_name',
        value: params['custrecord_jj_lname_'] || ''
      });

      donorRecord.setValue({
        fieldId: 'custrecord_jj_gender',
        value: params['custrecord_jj_gender_'] || ''
      });

      donorRecord.setValue({
        fieldId: 'custrecord_jj_phone_number',
        value: params['custrecord_jj_phone_number_'] || ''
      });

      donorRecord.setValue({
        fieldId: 'custrecord_jj_blood_group',
        value: params['custrecord_jj_blood_group_'] || ''
      });

      donorRecord.setValue({
        fieldId: 'custrecord_jj_last_donation_date',
        value: donationDate
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

    } catch (error) {
      log.error({ title: 'Error in processDonorSubmission', details: error });

      const errorForm = serverWidget.createForm({ title: 'Error' });
      const errorField = errorForm.addField({
        id: 'custpage_error_msg',
        type: serverWidget.FieldType.INLINEHTML,
        label: 'Error'
      });
      errorField.defaultValue = '<div style="padding:10px;border:1px solid #d32f2f;background:#ffebee;color:#c62828;font-weight:600;">Save Failed: ' + error.message + '</div>';
      context.response.writePage(errorForm);
    }
  }

  return {
    onRequest: onRequest
  };
});
