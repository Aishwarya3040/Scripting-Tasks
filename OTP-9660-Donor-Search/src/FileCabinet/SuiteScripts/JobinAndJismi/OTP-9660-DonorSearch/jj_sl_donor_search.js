/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
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
* Description   : Suitelet to search blood donor records. Allows filtering by blood group and 
*                 last donation date, displays eligible donors in a sublist, and shows results 
*                 inline on the form.
*
* REVISION HISTORY
*
* @version 1.0 : 14-November-2025 : Initial build created by JJ0416
*
*************************************************************************************************/

define(['N/ui/serverWidget', 'N/search', 'N/log'], function (serverWidget, search, log) {

    const customRecordType = 'customrecord_jj_blood_donor_record';
    const clientScriptPath = './jj_cs_donorsearch.js';

    /**
     * Entry point for Suitelet
     * @param {Object} context - Suitelet context
     */
    const onRequest = (context) => {
        try {
            log.debug('Suitelet Triggered', 'Request method: ' + context.request.method);
            displayForm(context);
        } catch (error) {
            log.error({ title: 'Error in onRequest', details: error.message });
        }
    };

    /**
     * Display the donor search form and results
     * @param {Object} context - Suitelet context
     */
    const displayForm = (context) => {
        try {
            log.debug('Display Form', 'Initializing form');

            const form = serverWidget.createForm({ title: 'Blood Donor Search' });
            form.clientScriptModulePath = clientScriptPath;

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

            log.debug('Received Parameters', `Blood Group: ${selectedBloodGroup}, Date: ${selectedDate}`);

            if (selectedBloodGroup && selectedDate) {
                bloodGroupField.defaultValue = selectedBloodGroup;
                lastDonationDateField.defaultValue = selectedDate;

                try {
                    log.debug('Search Start', 'Creating donor search');

                    const donorSearch = search.create({
                        type: customRecordType,
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

                    const donors = [];
                    donorSearch.run().each((result) => {
                        donors.push({
                            name: result.getValue('custrecord_jj_first_name') + ' ' + result.getValue('custrecord_jj_last_name'),
                            phone: result.getValue('custrecord_jj_phone_number'),
                            bloodGroup: result.getValue('custrecord_jj_blood_group'),
                            lastDonation: result.getValue('custrecord_jj_last_donation_date')
                        });
                        return true;
                    });

                    log.audit('Search Results', `Found ${donors.length} donor(s)`);

                    const resultMsg = form.addField({
                        id: 'custpage_result_msg',
                        type: serverWidget.FieldType.INLINEHTML,
                        label: ' '
                    });
                    resultMsg.defaultValue = `<b>Found ${donors.length} eligible donor(s)</b>`;

                    if (donors.length > 0) {
                        const donorSublist = form.addSublist({
                            id: 'custpage_donors',
                            type: serverWidget.SublistType.LIST,
                            label: 'Eligible Donors'
                        });

                        donorSublist.addField({ id: 'custpage_name', type: serverWidget.FieldType.TEXT, label: 'Name' });
                        donorSublist.addField({ id: 'custpage_phone', type: serverWidget.FieldType.PHONE, label: 'Phone Number' });
                        donorSublist.addField({ id: 'custpage_bloodgroup', type: serverWidget.FieldType.TEXT, label: 'Blood Group' });
                        donorSublist.addField({ id: 'custpage_lastdonation', type: serverWidget.FieldType.DATE, label: 'Last Donation Date' });

                        donors.forEach((donor, index) => {
                            donorSublist.setSublistValue({ id: 'custpage_name', line: index, value: donor.name });
                            donorSublist.setSublistValue({ id: 'custpage_phone', line: index, value: donor.phone });
                            donorSublist.setSublistValue({ id: 'custpage_bloodgroup', line: index, value: donor.bloodGroup });
                            donorSublist.setSublistValue({ id: 'custpage_lastdonation', line: index, value: donor.lastDonation });
                        });
                    } else {
                        log.debug('Search Result', 'No donors found');

                        const noResultMsg = form.addField({
                            id: 'custpage_no_result',
                            type: serverWidget.FieldType.INLINEHTML,
                            label: ' '
                        });
                        noResultMsg.defaultValue = '<p>No eligible donors found for selected criteria.</p>';
                    }

                } catch (error) {
                    log.error({ title: 'Search Error', details: error.message });
                }
            } else {
                log.debug('Form Load', 'No parameters provided yet');
            }

            form.addSubmitButton({ label: 'Search' });

            log.debug('Form Ready', 'Writing form to response');
            context.response.writePage(form);
        } catch (error) {
            log.error({ title: 'Display Form Error', details: error.message });
        }
    };

    return {
        onRequest: onRequest
    };
});
