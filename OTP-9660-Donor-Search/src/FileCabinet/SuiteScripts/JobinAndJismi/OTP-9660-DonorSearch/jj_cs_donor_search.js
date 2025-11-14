/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
/************************************************************************************************
*  
* OTP-9660 : Search through Database to find Matching Donors
*
*************************************************************************************************
*
* Author        : Jobin and Jismi IT Services
*
* Date Created  : 14-November-2025
*
* Description   : Client Script validates blood donation form inputs. Ensures blood group and 
*                 last donation date are entered, checks that the date is not in the future, 
*                 and confirms that at least 90 days have passed since the last donation and displays the result
*
* REVISION HISTORY
*
* @version 1.0 : 14-November-2025 : Initial build created by JJ0416
*
*************************************************************************************************/

define(['N/ui/dialog'], function (dialog) {

    /**
     * Page initialization function
     * @param {Object} context - Page init context
     */
    const pageInit = (context) => {
        try {
            console.log('Client Script Loaded');
        } catch (error) {
            console.error('Error in pageInit', error.message);
        }
    };

    /**
     * Validate donation date
     * @param {string|Date} donationDate - Date of last donation
     * @returns {Object} validation result with valid flag and message
     */
    const validateDate = (donationDate) => {
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
            console.error('Error in validateDate', error.message);
            return { valid: false, message: 'Unexpected error during date validation.' };
        }
    };

    /**
     * Save record validation
     * @param {Object} context - Save record context
     * @returns {boolean} true if record is valid, false otherwise
     */
    const saveRecord = (context) => {
        try {
            const currentRec = context.currentRecord;

            const bloodGroup = currentRec.getValue({ fieldId: 'custpage_blood_group' });
            const lastDonationDate = currentRec.getValue({ fieldId: 'custpage_last_donation_date' });

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

            const validation = validateDate(lastDonationDate);
            if (!validation.valid) {
                dialog.alert({ title: 'Validation Error', message: validation.message });
                return false;
            }

            return true;

        } catch (error) {
            console.error('Error in saveRecord', error.message);
            return false;
        }
    };

    return {
        pageInit: pageInit,
        saveRecord: saveRecord
    };
});
