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
 * Date Created : 1-November-2025
 *
 * Description : Suitelet script to search eligible blood donors based on blood group and last donation date.
 *
 * REVISION HISTORY
 *
 * @version 1.1 : 12-November-2025 : Variable naming updated to camelCase by JJ0416
 *
*************************************************************************************************/

define(['N/ui/serverWidget', 'N/search', 'N/log'], function(serverWidget, search, log) {

  const customRecordType = 'customrecord_jj_blood_donor_record';
  const clientScriptPath = './jj_cs_donorsearch.js';

  /**
   * Entry point for the Suitelet request.
   * @param {SuiteletContext} context - The Suitelet context object.
   */
  function onRequest(context) {
    try {
      log.debug({ title: 'Suitelet Triggered', details: 'Request method: ' + context.request.method });
      renderDonorSearchForm(context);
    } catch (error) {
        log.error({ title: 'Error in onRequest', details: error.message || error.toString() });
    }
  }

  /**
   * Displays the blood donor search form and results if criteria are provided.
   * @param {SuiteletContext} context - The Suitelet context object.
   */
  function renderDonorSearchForm(context) {
    try {
      log.debug({ title: 'Render Form', details: 'Initializing form' });

      const donorSearchForm = serverWidget.createForm({ title: 'Blood Donor Search' });
      donorSearchForm.clientScriptModulePath = clientScriptPath;

      const bloodGroupField = donorSearchForm.addField({
        id: 'custpage_blood_group',
        type: serverWidget.FieldType.TEXT,
        label: 'Blood Group'
      });
      bloodGroupField.isMandatory = true;

      const donationDateField = donorSearchForm.addField({
        id: 'custpage_last_donation_date',
        type: serverWidget.FieldType.DATE,
        label: 'Last Donation Date (Before)'
      });
      donationDateField.isMandatory = true;

      const requestParams = context.request.parameters;
      const selectedBloodGroup = requestParams.custpage_blood_group;
      const selectedDonationDate = requestParams.custpage_last_donation_date;

      log.debug({ title: 'Received Parameters', details: `Blood Group: ${selectedBloodGroup}, Date: ${selectedDonationDate}` });

      if (selectedBloodGroup && selectedDonationDate) {
        bloodGroupField.defaultValue = selectedBloodGroup;
        donationDateField.defaultValue = selectedDonationDate;

        try {
          log.debug({ title: 'Search Start', details: 'Creating donor search' });

          const donorSearch = search.create({
            type: customRecordType,
            filters: [
              ['custrecord_jj_blood_group', 'is', selectedBloodGroup],
              'AND',
              ['custrecord_jj_last_donation_date', 'onorbefore', selectedDonationDate]
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
              fullName: result.getValue('custrecord_jj_first_name') + ' ' + result.getValue('custrecord_jj_last_name'),
              phoneNumber: result.getValue('custrecord_jj_phone_number'),
              bloodGroup: result.getValue('custrecord_jj_blood_group'),
              lastDonationDate: result.getValue('custrecord_jj_last_donation_date')
            });
            return true;
          });

          log.audit({ title: 'Search Results', details: `Found ${donorResults.length} donor(s)` });

          const resultMessageField = donorSearchForm.addField({
            id: 'custpage_result_msg',
            type: serverWidget.FieldType.INLINEHTML,
            label: ' '
          });
          resultMessageField.defaultValue = `<b>Found ${donorResults.length} eligible donor(s)</b>`;

          if (donorResults.length > 0) {
            const donorSublist = donorSearchForm.addSublist({
              id: 'custpage_donors',
              type: serverWidget.SublistType.LIST,
              label: 'Eligible Donors'
            });

            donorSublist.addField({ id: 'custpage_name', type: serverWidget.FieldType.TEXT, label: 'Name' });
            donorSublist.addField({ id: 'custpage_phone', type: serverWidget.FieldType.PHONE, label: 'Phone Number' });
            donorSublist.addField({ id: 'custpage_bloodgroup', type: serverWidget.FieldType.TEXT, label: 'Blood Group' });
            donorSublist.addField({ id: 'custpage_lastdonation', type: serverWidget.FieldType.DATE, label: 'Last Donation Date' });

            for (let i = 0; i < donorResults.length; i++) {
              donorSublist.setSublistValue({ id: 'custpage_name', line: i, value: donorResults[i].fullName });
              donorSublist.setSublistValue({ id: 'custpage_phone', line: i, value: donorResults[i].phoneNumber });
              donorSublist.setSublistValue({ id: 'custpage_bloodgroup', line: i, value: donorResults[i].bloodGroup });
              donorSublist.setSublistValue({ id: 'custpage_lastdonation', line: i, value: donorResults[i].lastDonationDate });
            }
          } else {
              log.debug({ title: 'Search Result', details: 'No donors found' });

            const noResultField = donorSearchForm.addField({
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

      donorSearchForm.addSubmitButton({ label: 'Search' });

      log.debug({ title: 'Form Ready', details: 'Writing form to response' });
      context.response.writePage(donorSearchForm);

    } catch (formError) {
        log.error({ title: 'Error in renderDonorSearchForm', details: formError.message || formError.toString() });
    }
  }

  return {
    onRequest: onRequest
  };
});
