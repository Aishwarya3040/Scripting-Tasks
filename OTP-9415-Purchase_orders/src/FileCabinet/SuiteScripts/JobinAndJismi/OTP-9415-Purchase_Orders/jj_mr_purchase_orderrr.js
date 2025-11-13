/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */
define(['N/search', 'N/file', 'N/email', 'N/record', 'N/runtime'], function(search, file, email, record, runtime) {

  function getInputData(context) {
    var selectedPOs = JSON.parse(runtime.getCurrentScript().getParameter({ name: 'custscript_selected_pos' }));
    return selectedPOs;
  }

  function map(context) {
    var po = JSON.parse(context.value);

    var poSearch = search.create({
      type: search.Type.PURCHASE_ORDER,
      filters: [['tranid', 'is', po.docnum]],
      columns: ['internalid', 'tranid', 'entity', 'total', 'employee']
    });

    var result = poSearch.run().getRange({ start: 0, end: 1 })[0];
    if (!result) return;

    var employeeId = result.getValue('employee');
    var employeeRecord = record.load({ type: 'employee', id: employeeId });
    var supervisorId = employeeRecord.getValue('supervisor');

    context.write({
      key: supervisorId,
      value: JSON.stringify({
        docnum: result.getValue('tranid'),
        customer: result.getText('entity'),
        amount: result.getValue('total'),
        memo: po.memo
      })
    });
  }

  function reduce(context) {
    var supervisorId = context.key;
    var records = context.values.map(function(val) {
      return JSON.parse(val);
    });

    var csv = 'Document Number,Memo,Customer,Total Amount\n';
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      csv += r.docnum + ',"' + r.memo + '",' + r.customer + ',' + r.amount + '\n';
    }

    var reportFile = file.create({
      name: 'PO_Report_' + supervisorId + '.csv',
      fileType: file.Type.CSV,
      contents: csv,
      folder: null
    });

    email.send({
      author: -5,
      recipients: supervisorId,
      subject: 'Pending Billing Purchase Orders Report',
      body: 'Please find attached the report of delayed purchase orders.',
      attachments: [reportFile]
    });
  }

  return {
    getInputData: getInputData,
    map: map,
    reduce: reduce
  };
});
