/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope Public
 */

/************************************************************************************************
 *  
 * Script Name  : OTP-9415 : Purchase Orders - Pending Billing
 *
 ************************************************************************************************
 *
 * Author       : Jobin and Jismi IT Services
 * Date Created : 13-November-2025
 *
 * Description  : Suitelet to display Purchase Orders pending billing (older than 30 days)
 *                with dynamic filter for "Created By (Employee)".
 *
 ************************************************************************************************/

define(['N/ui/serverWidget', 'N/search', 'N/log'], function(ui, search, log) {

  const CLIENT_SCRIPT_PATH = '/SuiteScripts/JobinAndJismi/OTP-9415-Purchase_Orders/jj_cs_purchase_order.js';

  function onRequest(context) {
    try {
      const { request, response } = context;
      const params = request.parameters;
      const employeeId = params.custpage_employee || '';

      // Create form
      const form = ui.createForm({ title: 'Purchase Orders - Pending Billing (Before 30 Days Ago)' });
      form.clientScriptModulePath = CLIENT_SCRIPT_PATH;

      // Employee filter
      const employeeField = form.addField({
        id: 'custpage_employee',
        type: ui.FieldType.SELECT,
        label: 'Created By (Employee)',
        source: 'employee'
      });
      if (employeeId) {
        employeeField.defaultValue = employeeId;
      }

      // Sublist
      const sublist = form.addSublist({
        id: 'custpage_po_sublist',
        type: ui.SublistType.LIST,
        label: 'Pending Billing Purchase Orders'
      });

      sublist.addField({ id: 'docnum', label: 'Document Number', type: ui.FieldType.TEXT });
      sublist.addField({ id: 'vendor', label: 'Vendor', type: ui.FieldType.TEXT });
      sublist.addField({ id: 'amount', label: 'Total Amount', type: ui.FieldType.CURRENCY });
      sublist.addField({ id: 'status', label: 'Status', type: ui.FieldType.TEXT });
      sublist.addField({ id: 'trandate', label: 'Date', type: ui.FieldType.DATE });

      // Filters
      const filters = [
        ['mainline', 'is', 'T'],
        'AND',
        ['status', 'anyof', 'PurchOrd:F'], // Pending Billing
        'AND',
        ['trandate', 'onorbefore', 'thirtydaysago']
      ];
      if (employeeId) {
        filters.push('AND', ['createdby', 'anyof', employeeId]);
      }

      // Search
      const poSearch = search.create({
        type: search.Type.PURCHASE_ORDER,
        filters: filters,
        columns: ['tranid', 'entity', 'total', 'statusref', 'trandate']
      });

      const results = poSearch.run().getRange({ start: 0, end: 50 });

      results.forEach((result, i) => {
        sublist.setSublistValue({ id: 'docnum', line: i, value: result.getValue('tranid') || '' });
        sublist.setSublistValue({ id: 'vendor', line: i, value: result.getText('entity') || '' });
        sublist.setSublistValue({ id: 'amount', line: i, value: result.getValue('total') || '' });
        sublist.setSublistValue({ id: 'status', line: i, value: result.getText('statusref') || '' });
        sublist.setSublistValue({ id: 'trandate', line: i, value: result.getValue('trandate') || '' });
      });

      response.writePage(form);

    } catch (e) {
      log.error({ title: 'Suitelet Error', details: e });
      context.response.write('An error occurred. Please contact your administrator.');
    }
  }

  return { onRequest };
});