/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */

/************************************************************************************************ 
 *  
 * OTP-9710 : External Custom Record form and actions
 * 
************************************************************************************************* 
 * 
 * Author: Jobin and Jismi IT Services 
 * 
 * Date Created : 28-October-2025 
 * 
 * Description : Suitelet and UserEvent scripts enable external users to submit customer queries directly into NetSuite without login access. 
 * 
 * REVISION HISTORY
 *
 * @version 1.0 : 28-October-2025 :  The initial build was created by JJ0416
 * 
*************************************************************************************************/ 

define(['N/ui/serverWidget', 'N/record', 'N/search', 'N/log'],
    /**
 * @param{serverWidget} serverWidget
 * @param{record} record
 * @param{search} search
 * @param{log} log
 */
    (serverWidget, record, search, log) => {
        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {
            try {
                if (scriptContext.request.method === 'GET') {
                    const form = createContactForm();
                    scriptContext.response.writePage(form);
                }
                else if (scriptContext.request.method === 'POST') {
                    const custName = scriptContext.request.parameters.custpage_custname;
                    const custEmail = scriptContext.request.parameters.custpage_email;
                    const subject = scriptContext.request.parameters.custpage_subject;
                    const message = scriptContext.request.parameters.custpage_message;

                    if (isDuplicateEmail(custEmail)) {
                        log.audit('Duplicate Submission Blocked', `Email already exists: ${custEmail}`);
                        scriptContext.response.write(`
                            <script>
                                alert('A record with this email address already exists. Please use a different email or contact support.');
                                history.back();
                            </script>
                        `);
                        return;
                    }
                    
                    const customerId = getCustomerByEmail(custEmail);
                    const recordId = createCustomRecord(custName, custEmail, subject, message, customerId);

                    log.audit('Custom Record Created', 'ID: ' + recordId);

                    scriptContext.response.write(`
                        <h2>Thank you for your submission!</h2>
                        <p>Your message has been successfully submitted.</p>
                    `);
                }
            }
            catch (error) {
                log.error('Error in onRequest', error);
                scriptContext.response.write('<h2>Error:</h2><p>' + error.message + '</p>');
            }
        }

        /**
         * Creates and returns a Suitelet form for external customer contact.
         * @returns {N/ui/serverWidget.Form} The created Suitelet form object
         * @throws {Error} If form creation fails
         */
        function createContactForm() {
            try {
                const form = serverWidget.createForm({
                    title: 'External Customer Contact Form'
                });

                form.addField({
                    id: 'custpage_custname',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Customer Name'
                }).isMandatory = true;

                form.addField({
                    id: 'custpage_email',
                    type: serverWidget.FieldType.EMAIL,
                    label: 'Customer Email'
                }).isMandatory = true;

                form.addField({
                    id: 'custpage_subject',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Subject'
                }).isMandatory = true;

                form.addField({
                    id: 'custpage_message',
                    type: serverWidget.FieldType.LONGTEXT,
                    label: 'Message'
                }).isMandatory = true;

                form.addSubmitButton({ label: 'Search' });
                form.addResetButton({ label: 'Reset' });
                
                return form;
            }
            catch (error) {
                log.error('Error in createContactForm', error);
                throw error;
            }
        }

        /**
         * Retrieves a customer’s internal ID using their email address.
         * @param {string} custEmail - Customer email to search for
         * @returns {number|null} The internal ID of the customer, or null if not found
         * @throws {Error} If the search operation fails
         */
        function getCustomerByEmail(custEmail) {
            try {
                const result = search.create({
                    type: search.Type.CUSTOMER,
                    filters: [['email', 'is', custEmail]],
                    columns: ['internalid']
                }).run().getRange({ start: 0, end: 1 });

                if (result.length > 0) {
                    return result[0].getValue('internalid');
                }
                return null;
            }
            catch (error) {
                log.error('Error in getCustomerByEmail', error);
                throw error;
            }
        }

        /**
         * Checks whether a customer email already exists in the custom record 'JJ Custom Customer Form'.
         * @param {string} custEmail - The email address to check for duplicates.
         * @returns {boolean} Returns true if a duplicate email exists; otherwise, false.
         * @throws {Error} Throws an error if the search operation fails.
         */
        function isDuplicateEmail(custEmail) {
            try {
                const duplicateSearch = search.create({
                    type: 'customrecord_jj_customerinquiry',
                    filters: [['custrecord_jj_customer_email', 'is', custEmail]],
                    columns: ['internalid']
                }).run().getRange({ start: 0, end: 1 });

                const isDuplicate = duplicateSearch.length > 0;

                if (isDuplicate) {
                    alert('This email already exists. Please use a different email address.');
                }

                return isDuplicate;
            } catch (error) {
                log.error('Error in isDuplicateEmail', error);
                throw error;
            }
        }

        /**
         * Creates a custom record storing the customer's form submission details.
         * @param {string} custName - Customer’s name
         * @param {string} custEmail - Customer’s email address
         * @param {string} subject - Message subject
         * @param {string} message - Message content
         * @param {number|null} customerId - Related customer internal ID (if found)
         * @returns {number} The internal ID of the created custom record
         * @throws {Error} If record creation fails
         */
        function createCustomRecord(custName, custEmail, subject, message, customerId) {
            try {
                const customRecord = record.create({
                    type: 'customrecord_jj_customerinquiry',
                    isDynamic: true
                });

                customRecord.setValue({
                    fieldId: 'custrecord_jj_customername', value: custName
                });
                customRecord.setValue({
                    fieldId: 'custrecord_jj_customer_email', value: custEmail
                });
                customRecord.setValue({
                    fieldId: 'custrecord_jj_subject', value: subject
                });
                customRecord.setValue({
                    fieldId: 'custrecord_jj_message', value: message
                });

                if (customerId) {
                    customRecord.setValue({
                        fieldId: 'custrecord_jj_customer',
                        value: customerId
                    });
                }

                const recordId = customRecord.save();
                return recordId;
            }
            catch (error) {
                log.error('Error in createCustomRecord', error);
                throw error;
            }
        }

        return { onRequest }

    });