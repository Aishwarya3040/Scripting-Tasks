/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope Public
 */

define(['N/ui/serverWidget', 'N/search', 'N/log', 'N/file', 'N/email', 'N/runtime', 'N/record'],
function (ui, search, log, file, email, runtime, record) {

    const CLIENT_SCRIPT_PATH = '/SuiteScripts/JobinAndJismi/OTP-9415-Purchase_Orders/jj_cs_purchase_order.js';
    const ADMIN_EMPLOYEE_ID = -5;
    const CSV_FOLDER_ID = 831; // Replace with your actual folder ID

    function onRequest(context) {
        try {
            const request = context.request;
            const params = request.parameters;
            const pageIndex = parseInt(params.pageIndex || '0', 10);
            const employeeId = params.custpage_employee || '';
            const isConfirmed = params.custpage_confirmed === 'true';

            if (request.method === 'GET') {
                const form = ui.createForm({ title: 'Purchase Orders - Pending Billing Report' });
                form.clientScriptModulePath = CLIENT_SCRIPT_PATH;

                const employeeField = form.addField({
                    id: 'custpage_employee',
                    type: ui.FieldType.SELECT,
                    label: 'Created By (Employee)',
                    source: 'employee'
                });
                if (employeeId) employeeField.defaultValue = employeeId;

                form.addField({
                    id: 'custpage_pageindex',
                    type: ui.FieldType.INTEGER,
                    label: 'Page Index'
                }).updateDisplayType({ displayType: ui.FieldDisplayType.HIDDEN }).defaultValue = pageIndex;

                const sublist = form.addSublist({
                    id: 'custpage_po_sublist',
                    type: ui.SublistType.INLINEEDITOR,
                    label: 'Pending Billing Purchase Orders'
                });

                sublist.addField({ id: 'select', label: 'Select', type: ui.FieldType.CHECKBOX });
                sublist.addField({ id: 'docnum', label: 'Document Number', type: ui.FieldType.TEXT });
                sublist.addField({ id: 'vendor', label: 'Customer', type: ui.FieldType.TEXT });
                sublist.addField({ id: 'amount', label: 'Total Amount', type: ui.FieldType.CURRENCY });
                sublist.addField({ id: 'memo', label: 'Memo', type: ui.FieldType.TEXTAREA });
                sublist.addField({ id: 'trandate', label: 'Date', type: ui.FieldType.DATE });

                const filters = [
                    ['mainline', 'is', 'T'],
                    'AND',
                    ['status', 'anyof', 'PurchOrd:F'],
                    'AND',
                    ['trandate', 'onorbefore', 'thirtydaysago']
                ];
                if (employeeId) filters.push('AND', ['createdby', 'anyof', employeeId]);

                const poSearch = search.create({
                    type: search.Type.PURCHASE_ORDER,
                    filters: filters,
                    columns: ['tranid', 'entity', 'total', 'trandate']
                });

                const start = pageIndex * 10;
                const end = start + 10;
                const results = poSearch.run().getRange({ start, end });

                results.forEach((result, i) => {
                    sublist.setSublistValue({ id: 'docnum', line: i, value: result.getValue('tranid') });
                    sublist.setSublistValue({ id: 'vendor', line: i, value: result.getText('entity') });
                    sublist.setSublistValue({ id: 'amount', line: i, value: result.getValue('total') });
                    sublist.setSublistValue({ id: 'trandate', line: i, value: result.getValue('trandate') });
                });

                if (pageIndex > 0) {
                    form.addButton({
                        id: 'custpage_prev',
                        label: 'Previous',
                        functionName: `navigatePage(${pageIndex - 1})`
                    });
                }
                if (results.length === 10) {
                    form.addButton({
                        id: 'custpage_next',
                        label: 'Next',
                        functionName: `navigatePage(${pageIndex + 1})`
                    });
                }

                form.addSubmitButton({ label: 'Generate Report' });
                context.response.writePage(form);

            } else if (!isConfirmed) {
                const supervisorPOMap = {};
                const lineCount = request.getLineCount({ group: 'custpage_po_sublist' });

                for (let i = 0; i < lineCount; i++) {
                    const isSelected = request.getSublistValue({ group: 'custpage_po_sublist', name: 'select', line: i });
                    if (isSelected === 'T') {
                        const memo = request.getSublistValue({ group: 'custpage_po_sublist', name: 'memo', line: i });
                        const docnum = request.getSublistValue({ group: 'custpage_po_sublist', name: 'docnum', line: i });

                        const poSearch = search.create({
                            type: search.Type.PURCHASE_ORDER,
                            filters: [['tranid', 'is', docnum]],
                            columns: ['createdby', 'entity', 'total']
                        });

                        const result = poSearch.run().getRange({ start: 0, end: 1 })[0];
                        const creatorId = result.getValue('createdby');
                        const vendor = result.getText('entity');
                        const amount = result.getValue('total');

                        let supervisorEmail = 'fallback@example.com';
                        let supervisorId = null;

                        if (creatorId) {
                            const empData = record.load({ type: 'employee', id: creatorId });
                            supervisorId = empData.getValue('supervisor');
                            if (supervisorId) {
                                const supervisorData = record.load({ type: 'employee', id: supervisorId });
                                const emailAddr = supervisorData.getValue('email');
                                if (emailAddr) supervisorEmail = emailAddr;
                            }
                        }

                        if (!supervisorPOMap[supervisorEmail]) {
                            supervisorPOMap[supervisorEmail] = {
                                supervisorId: supervisorId,
                                pos: []
                            };
                        }

                        supervisorPOMap[supervisorEmail].pos.push({ docnum, memo, vendor, amount });
                    }
                }

                if (Object.keys(supervisorPOMap).length === 0) {
                    context.response.write('No purchase orders selected.');
                    return;
                }

                const confirmForm = ui.createForm({ title: 'Confirm Purchase Orders and Reasons' });

                confirmForm.addField({
                    id: 'custpage_confirmed',
                    type: ui.FieldType.TEXT,
                    label: 'Confirmed'
                }).updateDisplayType({ displayType: ui.FieldDisplayType.HIDDEN }).defaultValue = 'true';

                const confirmSublist = confirmForm.addSublist({
                    id: 'custpage_result_sublist',
                    type: ui.SublistType.INLINEEDITOR,
                    label: 'Selected Purchase Orders'
                });

                confirmSublist.addField({ id: 'supervisor', label: 'Supervisor Email', type: ui.FieldType.TEXT });
                confirmSublist.addField({ id: 'docnum', label: 'Document Number', type: ui.FieldType.TEXT });
                confirmSublist.addField({ id: 'memo', label: 'Memo', type: ui.FieldType.TEXTAREA });
                confirmSublist.addField({ id: 'vendor', label: 'Customer', type: ui.FieldType.TEXT });
                confirmSublist.addField({ id: 'amount', label: 'Total Amount', type: ui.FieldType.CURRENCY });

                let line = 0;
                Object.entries(supervisorPOMap).forEach(([emailAddr, data]) => {
                    data.pos.forEach(po => {
                        confirmSublist.setSublistValue({ id: 'supervisor', line, value: emailAddr });
                        confirmSublist.setSublistValue({ id: 'docnum', line, value: po.docnum });
                        confirmSublist.setSublistValue({ id: 'memo', line, value: po.memo });
                        confirmSublist.setSublistValue({ id: 'vendor', line, value: po.vendor });
                        confirmSublist.setSublistValue({ id: 'amount', line, value: po.amount });
                        line++;
                    });
                });

                confirmForm.addSubmitButton({ label: 'Send Emails' });
                context.response.writePage(confirmForm);

            } else {
                const lineCount = request.getLineCount({ group: 'custpage_result_sublist' });

                if (lineCount === 0) {
                    context.response.write('No purchase orders selected.');
                    return;
                }

                const supervisorPOMap = {};

                for (let i = 0; i < lineCount; i++) {
                    const emailAddr = request.getSublistValue({ group: 'custpage_result_sublist', name: 'supervisor', line: i });
                    const docnum = request.getSublistValue({ group: 'custpage_result_sublist', name: 'docnum', line: i });
                    const memo = request.getSublistValue({ group: 'custpage_result_sublist', name: 'memo', line: i });
                    const vendor = request.getSublistValue({ group: 'custpage_result_sublist', name: 'vendor', line: i });
                         const amount = request.getSublistValue({ group: 'custpage_result_sublist', name: 'amount', line: i });

                    if (!supervisorPOMap[emailAddr]) {
                        supervisorPOMap[emailAddr] = [];
                    }

                    supervisorPOMap[emailAddr].push({ docnum, memo, vendor, amount });
                }

                Object.entries(supervisorPOMap).forEach(([emailAddr, poList]) => {
                    try {
                        let csvContent = 'Supervisor Email,Document Number,Memo,Customer,Total Amount\n';
                        poList.forEach(po => {
                            csvContent += `"${emailAddr}","${po.docnum}","${po.memo}","${po.vendor}","${po.amount}"\n`;
                        });

                        const csvFile = file.create({
                            name: `PO_Report_${emailAddr.replace(/[^a-zA-Z0-9]/g, '_')}.csv`,
                            fileType: file.Type.CSV,
                            contents: csvContent,
                            folder: CSV_FOLDER_ID
                        });

                        csvFile.save();

                        email.send({
                            author: ADMIN_EMPLOYEE_ID,
                            recipients: supervisorId,
                            subject: 'Pending Billing Purchase Orders Report',
                            body: 'Please find attached the report for selected purchase orders.',
                            attachments: [csvFile]
                        });

                        log.audit({
                            title: 'Email Sent',
                            details: `Report emailed to ${emailAddr} with ${poList.length} POs.`
                        });
                    } catch (err) {
                        log.error({
                            title: `Email Error for ${emailAddr}`,
                            details: err
                        });
                    }
                });

                context.response.write('✅ Emails sent successfully to all supervisors.');
            }
        } catch (e) {
            log.error({ title: 'Suitelet Error', details: e });

            const form = ui.createForm({ title: 'Error - Purchase Order Report' });
            form.addField({
                id: 'custpage_error',
                type: ui.FieldType.INLINEHTML,
                label: 'Error Message'
            }).defaultValue = `<div style="color:red;"><strong>An unexpected error occurred:</strong><br>${e.message || e.toString()}<br>Please contact your administrator.</div>`;

            context.response.writePage(form);
        }
    }

    return { onRequest };
});