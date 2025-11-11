/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */

/************************************************************************************************
 *  
 * OTP-9660 : Search through the database to find the matching blood donors
 *
*************************************************************************************************
 *
 * Author: Jobin and Jismi IT Services
 *
 * Date Created : 11-November-2025
 *
 * Description : Suitelet script to search eligible blood donors based on blood group and last donation date.
 *
 * REVISION HISTORY
 *
 * @version 1.0 : 11-November-2025 : Initial build created by JJ0416
 *
*************************************************************************************************/

define(['N/ui/serverWidget', 'N/search', 'N/log'], function(serverWidget, search, log) {

  const CUSTOM_RECORD_TYPE = 'customrecord_jj_blood_donor_record';
  const CLIENT_SCRIPT_PATH = './jj_cs_donorsearch.js';

  /**
   * Entry point for the Suitelet request.
   * @param {SuiteletContext} context - The Suitelet context object.
   */
  function onRequest(context) {
    try {
      log.debug({ title: 'Suitelet Triggered', details: 'Request method: ' + context.request.method });
      displayDonorSearchForm(context);
    } catch (error) {
      log.error({ title: 'Error in onRequest', details: error.message || error.toString() });
    }
  }

  /**
   * Displays the blood donor search form and results if criteria are provided.
   * @param {SuiteletContext} context - The Suitelet context object.
   */
  function displayDonorSearchForm(context) {
    try {
      log.debug({ title: 'Display Form', details: 'Initializing form' });

      const form = serverWidget.createForm({ title: 'Blood Donor Search' });
      form.clientScriptModulePath = CLIENT_SCRIPT_PATH;

      const bloodGroupField = form.addField({
        id: 'custpage_blood_group',
        type: serverWidget.FieldType.TEXT,
        label: 'Blood Group'
      });
      bloodGroupField.isMandatory = true;

      const lastDonationDateField = form.addField({
        id: 'custpage_last_donation_date',
        type: serverWidget.FieldType.DATE,
        label: 'Last Donation Date (Before)'
      });
      lastDonationDateField.isMandatory = true;

      const params = context.request.parameters;
      const selectedBloodGroup = params.custpage_blood_group;
      const selectedDate = params.custpage_last_donation_date;

      log.debug({ title: 'Received Parameters', details: `Blood Group: ${selectedBloodGroup}, Date: ${selectedDate}` });

      if (selectedBloodGroup && selectedDate) {
        bloodGroupField.defaultValue = selectedBloodGroup;
        lastDonationDateField.defaultValue = selectedDate;

        try {
          log.debug({ title: 'Search Start', details: 'Creating donor search' });

          const donorSearch = search.create({
            type: CUSTOM_RECORD_TYPE,
            filters: [
              ['custrecord_jj_blood_group', 'is', selectedBloodGroup],
              'AND',
              ['custrecord_jj_last_donation_date', 'onorbefore', selectedDate]
            ],
            columns: [
              'custrecord_jj_first_name',
              'custrecord_jj_last_name',
              'custrecord_jj_phone_number',
              'custrecord_jj_gender',
              'custrecord_jj_last_donation_date',
              'custrecord_jj_blood_group'
            ]
          });

          const donorResults = [];
          donorSearch.run().each(function(result) {
            donorResults.push({
              name: result.getValue('custrecord_jj_first_name') + ' ' + result.getValue('custrecord_jj_last_name'),
              phone: result.getValue('custrecord_jj_phone_number'),
              bloodGroup: result.getValue('custrecord_jj_blood_group'),
              lastDonation: result.getValue('custrecord_jj_last_donation_date')
            });
            return true;
          });

          log.audit({ title: 'Search Results', details: `Found ${donorResults.length} donor(s)` });

          const resultMessageField = form.addField({
            id: 'custpage_result_msg',
            type: serverWidget.FieldType.INLINEHTML,
            label: ' '
          });
          resultMessageField.defaultValue = `<b>Found ${donorResults.length} eligible donor(s)</b>`;

          if (donorResults.length > 0) {
            const donorSublist = form.addSublist({
              id: 'custpage_donors',
              type: serverWidget.SublistType.LIST,
              label: 'Eligible Donors'
            });

            donorSublist.addField({ id: 'custpage_name', type: serverWidget.FieldType.TEXT, label: 'Name' });
            donorSublist.addField({ id: 'custpage_phone', type: serverWidget.FieldType.PHONE, label: 'Phone Number' });
            donorSublist.addField({ id: 'custpage_bloodgroup', type: serverWidget.FieldType.TEXT, label: 'Blood Group' });
            donorSublist.addField({ id: 'custpage_lastdonation', type: serverWidget.FieldType.DATE, label: 'Last Donation Date' });

            for (let i = 0; i < donorResults.length; i++) {
              donorSublist.setSublistValue({ id: 'custpage_name', line: i, value: donorResults[i].name });
              donorSublist.setSublistValue({ id: 'custpage_phone', line: i, value: donorResults[i].phone });
              donorSublist.setSublistValue({ id: 'custpage_bloodgroup', line: i, value: donorResults[i].bloodGroup });
              donorSublist.setSublistValue({ id: 'custpage_lastdonation', line: i, value: donorResults[i].lastDonation });
            }
          } else {
            log.debug({ title: 'Search Result', details: 'No donors found' });

            const noResultField = form.addField({
              id: 'custpage_no_result',
              type: serverWidget.FieldType.INLINEHTML,
              label: ' '
            });
            noResultField.defaultValue = '<p>No eligible donors found for selected criteria.</p>';
          }

        } catch (searchError) {
          log.error({ title: 'Search Error', details: searchError.message || searchError.toString() });
        }
      } else {
        log.debug({ title: 'Form Load', details: 'No parameters provided yet' });
      }

      form.addSubmitButton({ label: 'Search' });

      log.debug({ title: 'Form Ready', details: 'Writing form to response' });
      context.response.writePage(form);

    } catch (formError) {
      log.error({ title: 'Error in displayDonorSearchForm', details: formError.message || formError.toString() });
    }
  }

  return {
    onRequest: onRequest
  };
});
