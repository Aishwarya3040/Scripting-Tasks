/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
/************************************************************************************************
*  
* OTP-9415 : Purchase Orders - Pending Billing Report (Suitelet)
*
*************************************************************************************************
*
* Author        : Jobin and Jismi IT Services
*
* Date Created  : 14-November-2025
*
* Description   : Suitelet to display purchase orders with "Pending Billing" status older than 
*                 one month. Allows filtering by employee, selection with checkboxes, memo entry, 
*                 pagination, and emailing compiled CSV reports to supervisors.
*
* REVISION HISTORY
*
* @version 1.0 : 14-November-2025 : Initial build created by JJ0416
*
*************************************************************************************************/

define(['N/ui/serverWidget', 'N/search', 'N/log', 'N/file', 'N/email', 'N/runtime', 'N/record'],
  function (ui, search, log, file, email, runtime, record) {

    const clientScriptPath = '/SuiteScripts/JobinAndJismi/OTP-9415-Purchase_Orders/jj_cs_purchase_order.js';
    const adminEmployeeId = -5;
    const csvFolderId = 831;

    function onRequest(context) {
      try {
        const request = context.request;
        const params = request.parameters;
        const pageIndex = parseInt(params.pageIndex || '0', 10);
        const employeeId = params.custpage_employee || '';
        const isConfirmed = params.custpage_confirmed === 'true';

        if (request.method === 'GET') {
          renderForm(context, pageIndex, employeeId);
        } else if (!isConfirmed) {
            handleSelection(context, request);
        } else {
            sendEmails(context, request);
        }
      } catch (error) {
          log.error({ title: 'Suitelet Error', details: error });
          renderError(context, error);
      }
    }

    /**
     * Render the initial form with filters and sublist
     */
    function renderForm(context, pageIndex, employeeId) {
      try {
        const form = ui.createForm({ title: 'Purchase Orders - Pending Billing Report' });
        form.clientScriptModulePath = clientScriptPath;

        const employeeField = form.addField({
          id: 'custpage_employee',
          type: ui.FieldType.SELECT,
          label: 'Created By (Employee)',
          source: 'employee'
        });
        if (employeeId) employeeField.defaultValue = employeeId;

        form.addField({
          id: 'custpage_pageIndex',
          type: ui.FieldType.INTEGER,
          label: 'Page Index'
        }).updateDisplayType({ displayType: ui.FieldDisplayType.HIDDEN }).defaultValue = pageIndex;

        const poSublist = form.addSublist({
          id: 'custpage_poSublist',
          type: ui.SublistType.INLINEEDITOR,
          label: 'Pending Billing Purchase Orders'
        });

        poSublist.addField({ id: 'select', label: 'Select', type: ui.FieldType.CHECKBOX });
        poSublist.addField({ id: 'docNum', label: 'Document Number', type: ui.FieldType.TEXT });
        poSublist.addField({ id: 'vendor', label: 'Customer', type: ui.FieldType.TEXT });
        poSublist.addField({ id: 'amount', label: 'Total Amount', type: ui.FieldType.CURRENCY });
        poSublist.addField({ id: 'memo', label: 'Memo', type: ui.FieldType.TEXTAREA });
        poSublist.addField({ id: 'tranDate', label: 'Date', type: ui.FieldType.DATE });

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

        const startIndex = pageIndex * 10;
        const endIndex = startIndex + 10;
        const results = poSearch.run().getRange({ start: startIndex, end: endIndex });

        results.forEach((result, lineIndex) => {
          poSublist.setSublistValue({ id: 'docNum', line: lineIndex, value: result.getValue('tranid') });
          poSublist.setSublistValue({ id: 'vendor', line: lineIndex, value: result.getText('entity') });
          poSublist.setSublistValue({ id: 'amount', line: lineIndex, value: result.getValue('total') });
          poSublist.setSublistValue({ id: 'tranDate', line: lineIndex, value: result.getValue('trandate') });
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
      } catch (error) {
          log.error({ title: 'Render Form Error', details: error });
      }
    }

    /**
     * Handle PO selection and show confirmation form
     */
    function handleSelection(context, request) {
      try {
        const supervisorPoMap = {};
        const lineCount = request.getLineCount({ group: 'custpage_poSublist' });

        for (let lineIndex = 0; lineIndex < lineCount; lineIndex++) {
          const isSelected = request.getSublistValue({ group: 'custpage_poSublist', name: 'select', line: lineIndex });
          if (isSelected === 'T') {
            const memo = request.getSublistValue({ group: 'custpage_poSublist', name: 'memo', line: lineIndex });
            const docNum = request.getSublistValue({ group: 'custpage_poSublist', name: 'docNum', line: lineIndex });

            const poSearch = search.create({
              type: search.Type.PURCHASE_ORDER,
              filters: [['tranid', 'is', docNum]],
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
                const emailAddress = supervisorData.getValue('email');
                if (emailAddress) supervisorEmail = emailAddress;
              }
            }

            if (!supervisorPoMap[supervisorEmail]) {
              supervisorPoMap[supervisorEmail] = { supervisorId: supervisorId, pos: [] };
            }

            supervisorPoMap[supervisorEmail].pos.push({ docNum, memo, vendor, amount });
          }
        }

        if (Object.keys(supervisorPoMap).length === 0) {
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
          id: 'custpage_resultSublist',
          type: ui.SublistType.INLINEEDITOR,
          label: 'Selected Purchase Orders'
        });

        confirmSublist.addField({ id: 'supervisor', label: 'Supervisor Email', type: ui.FieldType.TEXT });
        confirmSublist.addField({ id: 'docNum', label: 'Document Number', type: ui.FieldType.TEXT });
        confirmSublist.addField({ id: 'memo', label: 'Memo', type: ui.FieldType.TEXTAREA });
        confirmSublist.addField({ id: 'vendor', label: 'Customer', type: ui.FieldType.TEXT });
        confirmSublist.addField({ id: 'amount', label: 'Total Amount', type: ui.FieldType.CURRENCY });

        let lineIndex = 0;
        Object.entries(supervisorPoMap).forEach(([emailAddress, data]) => {
          data.pos.forEach(po => {
            confirmSublist.setSublistValue({ id: 'supervisor', line: lineIndex, value: emailAddress });
            confirmSublist.setSublistValue({ id: 'docNum', line: lineIndex, value: po.docNum });
            confirmSublist.setSublistValue({ id: 'memo', line: lineIndex, value: po.memo });
            confirmSublist.setSublistValue({ id: 'vendor', line: lineIndex, value: po.vendor });
            confirmSublist.setSublistValue({ id: 'amount', line: lineIndex, value: po.amount });
            lineIndex++;
          });
        });

        confirmForm.addSubmitButton({ label: 'Send Emails' });
        context.response.writePage(confirmForm);

      } catch (error) {
          log.error({ title: 'Handle Selection Error', details: error });
      }
    }

    /**
     * Send emails with CSV attachments to supervisors
     */
    function sendEmails(context, request) {
      try {
        const lineCount = request.getLineCount({ group: 'custpage_resultSublist' });

        if (lineCount === 0) {
          context.response.write('No purchase orders selected.');
          return;
        }

        const supervisorPoMap = {};

        for (let lineIndex = 0; lineIndex < lineCount; lineIndex++) {
          const emailAddress = request.getSublistValue({ group: 'custpage_resultSublist', name: 'supervisor', line: lineIndex });
          const docNum = request.getSublistValue({ group: 'custpage_resultSublist', name: 'docNum', line: lineIndex });
          const memo = request.getSublistValue({ group: 'custpage_resultSublist', name: 'memo', line: lineIndex });
          const vendor = request.getSublistValue({ group: 'custpage_resultSublist', name: 'vendor', line: lineIndex });
          const amount = request.getSublistValue({ group: 'custpage_resultSublist', name: 'amount', line: lineIndex });

          if (!supervisorPoMap[emailAddress]) {
            supervisorPoMap[emailAddress] = { supervisorId: null, pos: [] };
          }

          supervisorPoMap[emailAddress].pos.push({ docNum, memo, vendor, amount });
        }

        Object.entries(supervisorPoMap).forEach(([emailAddress, data]) => {
          try {
            const employeeSearch = search.create({
              type: search.Type.EMPLOYEE,
              filters: [['email', 'is', emailAddress]],
              columns: ['internalid']
            });

            const result = employeeSearch.run().getRange({ start: 0, end: 1 })[0];
            if (result) {
              data.supervisorId = result.getValue('internalid');
            }

            const { supervisorId, pos: poList } = data;

            let csvContent = 'Supervisor Email,Document Number,Memo,Customer,Total Amount\n';
            poList.forEach(po => {
              csvContent += `"${emailAddress}","${po.docNum}","${po.memo}","${po.vendor}","${po.amount}"\n`;
            });

            const csvFile = file.create({
              name: `PO_Report_${emailAddress.replace(/[^a-zA-Z0-9]/g, '_')}.csv`,
              fileType: file.Type.CSV,
              contents: csvContent,
              folder: csvFolderId
            });

            csvFile.save();

            if (supervisorId) {
              email.send({
                author: adminEmployeeId,
                recipients: supervisorId,
                subject: 'Pending Billing Purchase Orders Report',
                body: 'Please find attached the report for selected purchase orders.',
                attachments: [csvFile]
              });

              log.audit({
                title: 'Email Sent',
                details: `Report emailed to ${emailAddress} (ID: ${supervisorId}) with ${poList.length} POs.`
              });
            } else {
                log.error({
                  title: 'Supervisor ID Not Found',
                  details: `Could not find supervisor ID for email: ${emailAddress}`
              });
            }
          } catch (err) {
              log.error({
                title: `Email Error for ${emailAddress}`,
                details: err
            });
          }
        });

        context.response.write('✅ Emails sent successfully to all supervisors.');
      } catch (error) {
          log.error({ title: 'Send Emails Error', details: error });
          renderError(context, error);
      }
    }

    /**
     * Render error page with message
     */
    function renderError(context, error) {
      try {
        const errorForm = ui.createForm({ title: 'Error - Purchase Order Report' });
        errorForm.addField({
          id: 'custpage_error',
          type: ui.FieldType.INLINEHTML,
          label: 'Error Message'
        }).defaultValue = `<div style="color:red;"><strong>An unexpected error occurred:</strong><br>${error.message || error.toString()}<br>Please contact your administrator.</div>`;
        context.response.writePage(errorForm);
      } catch (err) {
          log.error({ title: 'Render Error Page Failed', details: err });
      }
    }

    return { onRequest };
  });
