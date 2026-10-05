import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  User,
  FileText,
  Package,
  Loader2
} from 'lucide-react';

import AIExtractor from './AIExtractor';
import { MultiProductDropdown } from './MultiProductDropdown';
import { supabase } from '../supabaseClient';
import { calculateItemAmount } from '../utils/calculations';

export { calculateItemAmount };

// ============================================================
// TOTAL SQFT / NOS DISPLAY
// ============================================================

function isSqftItem(item) {
  const per = String(item.per || '').toLowerCase();
  return (
    per.includes('sqft') ||
    per.includes('sq.ft') ||
    /sq\.?\s*ft/i.test(String(item.description || ''))
  );
}

function getCalculatedTotalSqft(item) {
  const quantityValue = item.quantity ?? '';
  const dimensions = String(item.description || '').match(
    /(\d+(?:\.\d+)?)\s*(?:x|X|\*|\u00D7|\u2715|\u2716)\s*(\d+(?:\.\d+)?)/
  );

  if (!dimensions || !(Number(quantityValue) > 0)) return '';

  return (
    Number(dimensions[1]) *
    Number(dimensions[2]) *
    Number(quantityValue)
  );
}

function formatTotalSqft(item) {
  const per = String(item.per || '').toLowerCase();

  if (isSqftItem(item)) {
    const total = Number(item.totalSqft ?? item.total_sqft) ||
      getCalculatedTotalSqft(item);

    return total
      ? `${total.toLocaleString('en-IN', {
      maximumFractionDigits: 2
    })} sqft`
      : '';
  }

  if (per === 'job' && !(Number(quantityValue) > 0)) {
    return 'Service';
  }

  return '';
}

// ============================================================
// INVOICE FORM
// ============================================================

export default function InvoiceForm({
  invoiceData,
  setInvoiceData,
  items,
  setItems
}) {
  const [
    clientPresets,
    setClientPresets
  ] = useState([]);

  const [
    loadingClients,
    setLoadingClients
  ] = useState(false);

  // ==========================================================
  // FETCH CLIENTS
  // ==========================================================

  useEffect(() => {
    async function fetchClients() {
      setLoadingClients(true);

      try {
        const {
          data,
          error
        } = await supabase
          .from('clients')
          .select('*')
          .order(
            'client_name',
            {
              ascending: true
            }
          );

        if (error) {
          throw error;
        }

        if (data) {
          setClientPresets(data);
        }
      } catch (err) {
        console.error(
          'Error fetching clients:',
          err.message
        );
      } finally {
        setLoadingClients(false);
      }
    }

    fetchClients();
  }, []);

  // ==========================================================
  // TOTALS
  // ==========================================================

  const itemsTotal =
    items.reduce(
      (acc, item) =>
        acc +
        calculateItemAmount(item),
      0
    );

  const freightVal =
    parseFloat(
      invoiceData.freight
    ) || 0;

  const grandTotal =
    itemsTotal + freightVal;

  // ==========================================================
  // SYNC GRAND TOTAL
  // ==========================================================

  useEffect(() => {
    if (
      invoiceData.amount !==
      grandTotal
    ) {
      setInvoiceData(prev => ({
        ...prev,
        amount: grandTotal
      }));
    }
  }, [
    items,
    invoiceData.freight,
    grandTotal
  ]);

  // ==========================================================
  // AI EXTRACTOR
  // ==========================================================

  const handleExtractedData = data => {
    setInvoiceData(prev => ({
      ...prev,

      clientName:
        data.clientName ||
        prev.clientName,

      poNo:
        data.poNo ||
        prev.poNo,

      poDate:
        data.poDate ||
        prev.poDate,

      clientAddress:
        data.clientAddress ||
        prev.clientAddress,

      clientGstin:
        data.clientGstin ||
        prev.clientGstin,

      clientVendorCode:
        data.clientVendorCode ||
        prev.clientVendorCode
    }));

    if (
      data.items &&
      Array.isArray(data.items)
    ) {
      setItems(
        data.items.map(item => ({
          description:
            item.description || '',

          hsn:
            item.hsn || '',

          quantity:
            item.quantity || 1,

          rate:
            item.rate || 0,

          baseRate:
            item.rate || 0,

          per:
            item.per || 'Nos'
        }))
      );
    }
  };

  // ==========================================================
  // CLIENT PRESET
  // ==========================================================

  const handlePresetChange = e => {
    const selected =
      clientPresets.find(
        p =>
          p.client_name ===
          e.target.value
      );

    if (selected) {
      setInvoiceData(prev => ({
        ...prev,

        clientName:
          selected.client_name ||
          '',

        clientGstin:
          selected.gst_no ||
          '',

        clientAddress:
          selected.address ||
          ''
      }));
    }
  };

  // ==========================================================
  // GENERIC FIELD SETTER
  // ==========================================================

  const set = (
    field,
    value
  ) => {
    setInvoiceData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // ==========================================================
  // ITEMS
  // ==========================================================

  const addItem = () =>
    setItems([
      ...items,
      {
        description: '',
        hsn: '',
        quantity: 1,
        rate: 0,
        baseRate: 0,
        per: 'Nos'
      }
    ]);

  const removeItem = i =>
    setItems(
      items.filter(
        (_, idx) =>
          idx !== i
      )
    );

  const setItem = (
    i,
    field,
    value
  ) => {
    const next = [
      ...items
    ];

    const item = {
      ...next[i],
      [field]: value
    };

    if (field === 'rate') {
      item.baseRate =
        parseFloat(value) || 0;
    }

    next[i] = item;

    setItems(next);
  };

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <>
      {/* ======================================================
          AI PDF EXTRACTOR
      ====================================================== */}

      <div className="card">

        <div className="card-header">

          <div className="card-icon">
            <FileText size={16} />
          </div>

          <div>
            <div className="card-title">
              Import from Purchase Order
            </div>

            <div className="card-subtitle">
              Drop a PO PDF to auto-fill
              the form using AI
            </div>
          </div>

        </div>

        <div className="card-body">
          <AIExtractor
            onExtractedData={
              handleExtractedData
            }
          />
        </div>

      </div>

      {/* ======================================================
          CLIENT DETAILS
      ====================================================== */}

      <div className="card">

        <div className="card-header">

          <div className="card-icon">
            <User size={16} />
          </div>

          <div>
            <div className="card-title">
              Client Details
            </div>

            <div className="card-subtitle">
              Billed to / Ship to information
            </div>
          </div>

        </div>

        <div className="card-body">

          <div
            className="form-row"
            style={{
              marginBottom: '18px'
            }}
          >

            <div
              className="form-group"
              style={{
                position: 'relative'
              }}
            >

              <label>
                Load Client from Database
              </label>

              <select
                className="form-control"
                onChange={
                  handlePresetChange
                }
                defaultValue=""
              >

                <option
                  value=""
                  disabled
                >
                  {loadingClients
                    ? 'Loading clients...'
                    : 'Select a saved client…'}
                </option>

                {clientPresets.map(
                  p => (
                    <option
                      key={p.id}
                      value={
                        p.client_name
                      }
                    >
                      {p.client_name}
                    </option>
                  )
                )}

              </select>

              {loadingClients && (
                <Loader2
                  size={14}
                  className="animate-spin"
                  style={{
                    position:
                      'absolute',
                    right: '12px',
                    top: '34px',
                    color: '#888'
                  }}
                />
              )}

            </div>

          </div>

          <div className="form-row">

            <div className="form-group">

              <label>
                Billing / Shipping Address
              </label>

              <textarea
                className="form-control"
                placeholder="Full address including city, state, PIN"
                value={
                  invoiceData.clientAddress ||
                  ''
                }
                onChange={e =>
                  set(
                    'clientAddress',
                    e.target.value
                  )
                }
              />

            </div>

          </div>

          <div className="form-row cols-2">

            <div className="form-group">

              <label>
                GSTIN
              </label>

              <input
                type="text"
                className="form-control"
                placeholder="27AABCA1234F1Z9"
                value={
                  invoiceData.clientGstin ||
                  ''
                }
                onChange={e =>
                  set(
                    'clientGstin',
                    e.target.value
                  )
                }
              />

            </div>

            <div className="form-group">

              <label>
                Vendor Code
              </label>

              <input
                type="text"
                className="form-control"
                placeholder="e.g. 102914"
                value={
                  invoiceData.clientVendorCode ||
                  ''
                }
                onChange={e =>
                  set(
                    'clientVendorCode',
                    e.target.value
                  )
                }
              />

            </div>

          </div>

          <div className="form-row cols-2">

            <div className="form-group">

              <label>
                State
              </label>

              <input
                type="text"
                className="form-control"
                placeholder="Maharashtra"
                value={
                  invoiceData.clientState ||
                  ''
                }
                onChange={e =>
                  set(
                    'clientState',
                    e.target.value
                  )
                }
              />

            </div>

            <div className="form-group">

              <label>
                State Code
              </label>

              <input
                type="text"
                className="form-control"
                placeholder="27"
                value={
                  invoiceData.clientStateCode ||
                  ''
                }
                onChange={e =>
                  set(
                    'clientStateCode',
                    e.target.value
                  )
                }
              />

            </div>

          </div>

        </div>

      </div>

      {/* ======================================================
          INVOICE / PO DETAILS
      ====================================================== */}

      <div className="card">

        <div className="card-header">

          <div className="card-icon">
            <FileText size={16} />
          </div>

          <div>
            <div className="card-title">
              Invoice & PO Details
            </div>

            <div className="card-subtitle">
              Reference numbers and dates
            </div>
          </div>

        </div>

        <div className="card-body">

          <div className="form-row cols-3 invoice-date-client-row">

            <div className="form-group">

              <label>
                Invoice No.
              </label>

              <input
                type="text"
                className="form-control"
                value={
                  invoiceData.invoiceNo ||
                  ''
                }
                onChange={e =>
                  set(
                    'invoiceNo',
                    e.target.value
                  )
                }
              />

            </div>

            <div className="form-group">

              <label>
                Invoice Date
              </label>

              <input
                type="text"
                className="form-control"
                placeholder="DD/MM/YYYY"
                value={
                  invoiceData.invoiceDate ||
                  ''
                }
                onChange={e =>
                  set(
                    'invoiceDate',
                    e.target.value
                  )
                }
              />

            </div>

            <div className="form-group">

              <label>
                Client / Company Name
              </label>

              <input
                type="text"
                className="form-control"
                placeholder="e.g. Amcor Flexibles India Pvt Ltd"
                value={
                  invoiceData.clientName ||
                  ''
                }
                onChange={e =>
                  set(
                    'clientName',
                    e.target.value
                  )
                }
              />

            </div>

          </div>

          <div className="form-row cols-3">

            <div className="form-group">

              <label>
                PO Number
              </label>

              <input
                type="text"
                className="form-control"
                placeholder="e.g. PO-2024-001"
                value={
                  invoiceData.poNo ||
                  ''
                }
                onChange={e =>
                  set(
                    'poNo',
                    e.target.value
                  )
                }
              />

            </div>

            {/* <div className="form-group">

              <label>
                PO Date
              </label>

              <input
                type="text"
                className="form-control"
                placeholder="dd-mm-yyyy"
                value={
                  invoiceData.poDate ||
                  ''
                }
                onChange={e =>
                  set(
                    'poDate',
                    e.target.value
                  )
                }
              />

            </div> }*/ }

            <div className="form-group">

              <label>
                Freight (₹)
              </label>

              <input
                type="number"
                className="form-control"
                placeholder="0"
                value={
                  invoiceData.freight ||
                  ''
                }
                onChange={e =>
                  set(
                    'freight',
                    e.target.value
                  )
                }
              />

            </div>

          </div>

        </div>

      </div>

      {/* ======================================================
          LINE ITEMS
      ====================================================== */}

      <div className="card">

        <div className="card-header">

          <div className="card-icon">
            <Package size={16} />
          </div>

          <div>
            <div className="card-title">
              Line Items
            </div>

            <div className="card-subtitle">
              Products / services supplied
            </div>
          </div>

          <button
            className="btn btn-sm btn-outline"
            style={{
              marginLeft: 'auto'
            }}
            onClick={addItem}
          >
            <Plus size={13} />
            Add Row
          </button>

        </div>

        <div className="card-body">

          {/* QUICK ADD */}

          <div
            style={{
              marginBottom: '16px',
              background: '#f8f9fa',
              padding: '12px',
              borderRadius: '8px',
              border:
                '1px solid #e9ecef'
            }}
          >

            <div
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#495057',
                marginBottom: '6px'
              }}
            >
              ⚡ Quick Add Product
              (Searches catalog & appends row)
            </div>

            <MultiProductDropdown
              onAddProduct={prodItem => {
                setItems(
                  prevItems => [
                    ...prevItems,
                    prodItem
                  ]
                );
              }}
            />

          </div>

          {/* ITEMS */}

          {items.length === 0 ? (

            <div className="items-empty">
              No items yet — use the quick add
              above, add a row manually, or
              drop a PO PDF to auto-fill.
            </div>

          ) : (

            <table
              className="items-table"
              style={{
                fontSize: '14px'
              }}
            >

              <thead>

                <tr>

                  <th
                    style={{
                      width: '34%',
                      fontSize: '13px'
                    }}
                  >
                    Description
                  </th>

                  <th
                    style={{
                      width: '12%',
                      fontSize: '13px'
                    }}
                  >
                    HSN
                  </th>

                  <th
                    style={{
                      width: '12%',
                      fontSize: '13px'
                    }}
                  >
                    Total sqft/nos
                  </th>

                  <th
                    style={{
                      width: '12%',
                      fontSize: '13px'
                    }}
                  >
                    Qty
                  </th>

                  <th
                    style={{
                      width: '12%',
                      fontSize: '13px'
                    }}
                  >
                    Rate (₹)
                  </th>

                  <th
                    style={{
                      width: '14%',
                      fontSize: '13px'
                    }}
                  >
                    Amount
                  </th>

                  <th
                    style={{
                      width: '4%',
                      fontSize: '13px'
                    }}
                  />

                </tr>

              </thead>

              <tbody>

                {items.map(
                  (item, i) => {

                    const amount =
                      calculateItemAmount(
                        item
                      );

                    return (
                      <tr key={i}>

                        {/* DESCRIPTION */}

                        <td>

                          <textarea
                            className="form-control"
                            rows={2}
                            placeholder="e.g. 3 pcs vinyl stickers 4*2"
                            value={
                              item.description ||
                              ''
                            }
                            onChange={e =>
                              setItem(
                                i,
                                'description',
                                e.target.value
                              )
                            }
                            style={{
                              fontSize: '14px',
                              lineHeight: '1.35',
                              minHeight: '54px',
                              resize: 'vertical'
                            }}
                          />

                        </td>

                        {/* HSN */}

                        <td>

                          <input
                            type="text"
                            className="form-control"
                            placeholder="HSN"
                            value={
                              item.hsn ||
                              ''
                            }
                            onChange={e =>
                              setItem(
                                i,
                                'hsn',
                                e.target.value
                              )
                            }
                            style={{
                              fontSize: '14px'
                            }}
                          />

                        </td>

                        {/* TOTAL SQFT / NOS */}

                        <td>
                          {isSqftItem(item) ? (
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              className="form-control"
                              aria-label="Optional total square feet"
                              title="Leave blank to use the calculated area"
                              value={item.totalSqft ?? ''}
                              placeholder={String(
                                getCalculatedTotalSqft(item) || ''
                              )}
                              onChange={e =>
                                setItem(i, 'totalSqft', e.target.value)
                              }
                              style={{
                                padding: '7px 6px',
                                fontSize: '13px',
                                color: 'var(--cc-teal)'
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                fontSize: '13px',
                                fontWeight: 500,
                                color: 'var(--cc-teal)',
                                padding: '6px 4px',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {formatTotalSqft(item) || '-'}
                            </div>
                          )}
                        </td>

                        {/* QTY AND UOM */}

                        <td>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              minWidth: 0
                            }}
                          >
                            <input
                              type="number"
                              className="form-control"
                              value={
                                String(item.per || '').toLowerCase() === 'job' &&
                                !(Number(item.quantity) > 0)
                                  ? ''
                                  : item.quantity || ''
                              }
                              placeholder="Qty"
                              onChange={e =>
                                setItem(i, 'quantity', e.target.value)
                              }
                              style={{
                                flex: '1 1 0',
                                minWidth: 0,
                                padding: '7px 6px',
                                fontSize: '13px'
                              }}
                            />
                            <select
                              className="form-control"
                              value={item.per || 'Nos'}
                              onChange={e =>
                                setItem(i, 'per', e.target.value)
                              }
                              style={{
                                flex: '1.1 1 0',
                                minWidth: 0,
                                padding: '7px 6px',
                                fontSize: '12px'
                              }}
                            >
                              <option value="Nos">Nos</option>
                              <option value="sqft">sqft</option>
                              <option value="Set">Set</option>
                              <option value="Job">Job</option>
                            </select>
                          </div>
                        </td>

                        {/* RATE */}

                        <td>

                          <input
                            type="number"
                            className="form-control"
                            value={
                              item.baseRate ||
                              item.rate ||
                              ''
                            }
                            onChange={e =>
                              setItem(
                                i,
                                'rate',
                                e.target.value
                              )
                            }
                            style={{
                              fontSize: '14px'
                            }}
                          />

                        </td>

                        {/* AMOUNT */}

                        <td
                          style={{
                            fontWeight: 600,
                            fontSize: '14px',
                            color:
                              'var(--cc-teal)',
                            whiteSpace:
                              'nowrap'
                          }}
                        >
                          ₹
                          {amount.toFixed(2)}
                        </td>

                        {/* DELETE */}

                        <td>

                          <button
                            className="btn-icon"
                            onClick={() =>
                              removeItem(i)
                            }
                            title="Remove"
                          >
                            <Trash2 size={13} />
                          </button>

                        </td>

                      </tr>
                    );
                  }
                )}

              </tbody>

            </table>

          )}

        </div>

        {/* GRAND TOTAL */}

        <div
          style={{
            padding:
              '12px 20px',
            display: 'flex',
            justifyContent:
              'flex-end',
            borderTop:
              '1px solid #eee',
            background:
              '#fafafa',
            fontWeight: 'bold',
            fontSize: '15px'
          }}
        >
          Grand Total:
          ₹
          {grandTotal.toFixed(2)}
        </div>

      </div>
    </>
  );
}