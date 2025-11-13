/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */

define(['N/url', 'N/currentRecord', 'N/log'], function(url, currentRecord, log) {

    const scriptId = 'customscript_jj_sl_purchase_orders'; // Replace with your Suitelet script ID
    const deploymentId = 'customdeploy_jj_sl_purchase_orders'; // Replace with your deployment ID

    function fieldChanged(context) {
        try {
            if (context.fieldId === 'custpage_employee') {
                const record = currentRecord.get();
                const employeeId = record.getValue({ fieldId: 'custpage_employee' });

                const params = {};
                if (employeeId) {
                    params.custpage_employee = employeeId;
                }

                const resolvedUrl = url.resolveScript({
                    scriptId: scriptId,
                    deploymentId: deploymentId,
                    params: params
                });

                window.location.href = resolvedUrl;
            }
        } catch (error) {
            log.error({ title: 'fieldChanged Error', details: error });
        }
    }

    function navigatePage(pageIndex) {
        const record = currentRecord.get();
        const employeeId = record.getValue({ fieldId: 'custpage_employee' });

        const params = { pageIndex: pageIndex };
        if (employeeId) params.custpage_employee = employeeId;

        const resolvedUrl = url.resolveScript({
            scriptId: scriptId,
            deploymentId: deploymentId,
            params: params
        });

        window.location.href = resolvedUrl;
    }

    return {
        fieldChanged: fieldChanged,
        navigatePage: navigatePage
    };
});