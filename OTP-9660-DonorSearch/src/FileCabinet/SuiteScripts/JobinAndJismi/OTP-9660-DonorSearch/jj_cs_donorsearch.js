/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
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
 * Description : Client script to validate blood donor form fields before submission.
 *
 * REVISION HISTORY
 *
 * @version 1.1 : 12-November-2025 : Variable naming updated to camelCase by JJ0416
 *
*************************************************************************************************/

define(['N/ui/dialog'], function(dialog) {

  /**
   * Executes when the page is initialized.
   * @param {PageInitContext} context - The page initialization context.
   */
  function onPageInit(context) {
    try {
      console.log('Client Script Loaded');
    } catch (initError) {
        console.error('Error in onPageInit', initError.message || initError.toString());
    }
  }

  /**
   * Validates the last donation date.
   * Ensures the date is not in the future and is at least 90 days ago.
   * @param {string} donationDateString - The date string to validate.
   * @returns {{valid: boolean, message?: string}} Validation result.
   */
  function validateDonationDate(donationDateString) {
    try {
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);

      const donationDate = new Date(donationDateString);
      donationDate.setHours(0, 0, 0, 0);

      if (donationDate > todayDate) {
        return { valid: false, message: 'Date cannot be in the future.' };
      }

      const daysDifference = Math.floor((todayDate - donationDate) / (1000 * 60 * 60 * 24));

      if (daysDifference < 90) {
        return {
          valid: false,
          message: 'Date must be at least 90 days ago.\nDays entered: ' + daysDifference + ' days'
        };
      }

      return { valid: true };
    } catch (validationError) {
        console.error('Error in validateDonationDate', validationError.message || validationError.toString());
      return { valid: false, message: 'Date validation failed due to an error.' };
    }
  }

  /**
   * Validates form fields before record submission.
   * @param {SaveRecordContext} context - The save record context.
   * @returns {boolean} True if valid, false otherwise.
   */
  function onSaveRecord(context) {
    try {
      const donorRecord = context.currentRecord;

      const bloodGroupValue = donorRecord.getValue({ fieldId: 'custpage_blood_group' });
      const donationDateValue = donorRecord.getValue({ fieldId: 'custpage_last_donation_date' });

      console.log('onSaveRecord triggered');
      console.log('Blood Group:', bloodGroupValue);
      console.log('Last Donation Date:', donationDateValue);

      const missingFieldLabels = [];

      if (!bloodGroupValue) {
        missingFieldLabels.push('Blood Group');
      }

      if (!donationDateValue) {
        missingFieldLabels.push('Last Donation Date');
      }

      if (missingFieldLabels.length > 0) {
        dialog.alert({
          title: 'Missing Information',
          message: 'Please enter: ' + missingFieldLabels.join(' and ')
        });
        return false;
      }

      const dateValidationResult = validateDonationDate(donationDateValue);
      if (!dateValidationResult.valid) {
        dialog.alert({ title: 'Validation Error', message: dateValidationResult.message });
        return false;
      }

      return true;

    } catch (saveError) {
        console.error('Error in onSaveRecord', saveError.message || saveError.toString());
      return false;
    }
  }

  return {
    pageInit: onPageInit,
    saveRecord: onSaveRecord
  };
});
