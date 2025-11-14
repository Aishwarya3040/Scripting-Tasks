/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
/************************************************************************************************
*  
* OTP-9415 : Purchase Orders - Pending Billing Report (Client Script)
*
*************************************************************************************************
*
* Author        : Jobin and Jismi IT Services
*
* Date Created  : 14-November-2025
*
* Description   : Client Script to support the Suitelet for Purchase Orders. 
*                 Handles employee filter changes by refreshing the page with updated results 
*                 and manages pagination navigation between pages of purchase orders.
*
* REVISION HISTORY
*
* @version 1.0 : 14-November-2025 : Initial build created by JJ0416
*
*************************************************************************************************/

define(['N/url', 'N/currentRecord', 'N/log'], function(url, currentRecord, log) {

    const suiteletScriptId = 'customscript_jj_sl_purchase_orders'; 
    const suiteletDeploymentId = 'customdeploy_jj_sl_purchase_orders'; 

    /**
     * Triggered when a field value changes.
     * Refreshes the Suitelet when Employee filter changes.
     * @param {Object} context - Field change context
     */
    const fieldChanged = (context) => {
        try {
            if (context.fieldId === 'custpage_employee') {
                const currentRec = currentRecord.get();
                const employeeId = currentRec.getValue({ fieldId: 'custpage_employee' });

                const params = {};
                if (employeeId) {
                    params.custpage_employee = employeeId;
                }

                const resolvedUrl = url.resolveScript({
                    scriptId: suiteletScriptId,
                    deploymentId: suiteletDeploymentId,
                    params: params
                });

                window.location.href = resolvedUrl;
            }
        } catch (error) {
            log.error({ title: 'fieldChanged Error', details: error });
        }
    };

    /**
     * Navigates between pages of purchase orders.
     * @param {number} pageIndex - Target page index
     */
    const navigatePage = (pageIndex) => {
        try {
            const currentRec = currentRecord.get();
            const employeeId = currentRec.getValue({ fieldId: 'custpage_employee' });

            const params = { pageIndex: pageIndex };
            if (employeeId) params.custpage_employee = employeeId;

            const resolvedUrl = url.resolveScript({
                scriptId: suiteletScriptId,
                deploymentId: suiteletDeploymentId,
                params: params
            });

            window.location.href = resolvedUrl;
        } catch (error) {
            log.error({ title: 'navigatePage Error', details: error });
        }
    };

    return {
        fieldChanged: fieldChanged,
        navigatePage: navigatePage
    };
});
