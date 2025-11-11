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
 * @version 1.0 : 11-November-2025 : Initial build created by JJ0416
 *
*************************************************************************************************/

define(['N/ui/dialog'], function(dialog) {

  /**
   * Executes when the page is initialized.
   * @param {PageInitContext} context - The page initialization context.
   */
  function pageInit(context) {
    try {
      console.log('Client Script Loaded');
    } catch (error) {
      console.error('Error in pageInit', error.message || error.toString());
    }
  }

  /**
   * Validates the last donation date.
   * Ensures the date is not in the future and is at least 90 days ago.
   * @param {string} donationDate - The date string to validate.
   * @returns {{valid: boolean, message?: string}} Validation result.
   */
  function validateDate(donationDate) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const selectedDate = new Date(donationDate);
      selectedDate.setHours(0, 0, 0, 0);

      if (selectedDate > today) {
        return { valid: false, message: 'Date cannot be in the future.' };
      }

      const diffDays = Math.floor((today - selectedDate) / (1000 * 60 * 60 * 24));

      if (diffDays < 90) {
        return {
          valid: false,
          message: 'Date must be at least 90 days ago.\nDays entered: ' + diffDays + ' days'
        };
      }

      return { valid: true };
    } catch (error) {
      console.error('Error in validateDate', error.message || error.toString());
      return { valid: false, message: 'Date validation failed due to an error.' };
    }
  }

  /**
   * Validates form fields before record submission.
   * @param {SaveRecordContext} context - The save record context.
   * @returns {boolean} True if valid, false otherwise.
   */
  function saveRecord(context) {
    try {
      const currentRecord = context.currentRecord;

      const bloodGroup = currentRecord.getValue({ fieldId: 'custpage_blood_group' });
      const lastDonationDate = currentRecord.getValue({ fieldId: 'custpage_last_donation_date' });

      console.log('saveRecord triggered');
      console.log('Blood Group:', bloodGroup);
      console.log('Last Donation Date:', lastDonationDate);

      const missingFields = [];

      if (!bloodGroup) {
        missingFields.push('Blood Group');
      }

      if (!lastDonationDate) {
        missingFields.push('Last Donation Date');
      }

      if (missingFields.length > 0) {
        dialog.alert({
          title: 'Missing Information',
          message: 'Please enter: ' + missingFields.join(' and ')
        });
        return false;
      }

      const validationResult = validateDate(lastDonationDate);
      if (!validationResult.valid) {
        dialog.alert({ title: 'Validation Error', message: validationResult.message });
        return false;
      }

      return true;

    } catch (error) {
      console.error('Error in saveRecord', error.message || error.toString());
      return false;
    }
  }

  return {
    pageInit: pageInit,
    saveRecord: saveRecord
  };
});
