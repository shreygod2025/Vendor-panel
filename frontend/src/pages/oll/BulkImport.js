import { useState, useRef } from "react";
import { apiClient } from "../../App";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import { FileSpreadsheet, Download, Upload, Loader2, CheckCircle, AlertCircle, Package, Receipt } from "lucide-react";
import { toast } from "sonner";

const BulkImport = () => {
  const [activeTab, setActiveTab] = useState("po");
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [poFile, setPoFile] = useState(null);
  const [invoiceFile, setInvoiceFile] = useState(null);
  const [poPreview, setPoPreview] = useState([]);
  const [invoicePreview, setInvoicePreview] = useState([]);
  
  const poFileRef = useRef(null);
  const invoiceFileRef = useRef(null);

  // Download sample PO CSV
  const downloadPOSample = () => {
    const sampleData = `po_number,vendor_name,receiver_name,delivery_address,contact_person,contact_number,delivery_date,status,grand_total,product_name,quantity,unit_price,tax_rate
"PO-HIST-001","Tech Components Pvt Ltd","Rahul Sharma","123 Industrial Area, Pune","Rahul Sharma","+91 9876543210","2025-12-15","delivered",94400,"Industrial Motor A1",2,15000,18
"PO-HIST-001","Tech Components Pvt Ltd","Rahul Sharma","123 Industrial Area, Pune","Rahul Sharma","+91 9876543210","2025-12-15","delivered",94400,"Steel Bearings Set",10,3500,18
"PO-HIST-002","Supreme Electricals","Priya Nair","456 Tech Park, Bangalore","Priya Nair","+91 9988776655","2025-12-20","delivered",59000,"Control Panel Unit",2,25000,18`;

    const blob = new Blob([sampleData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'purchase_orders_sample.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    toast.success("Sample PO file downloaded");
  };

  // Download sample Invoice CSV
  const downloadInvoiceSample = () => {
    const sampleData = `invoice_number,po_number,vendor_name,invoice_date,amount,logistics_cost,status,paid_amount,payment_date
"INV-001","PO-HIST-001","Tech Components Pvt Ltd","2025-12-16",94400,2500,"cleared",94400,"2025-12-20"
"INV-002","PO-HIST-002","Supreme Electricals","2025-12-21",59000,1500,"pending",0,""`;

    const blob = new Blob([sampleData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'invoices_sample.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    toast.success("Sample invoice file downloaded");
  };

  // Parse CSV
  const parseCSV = (text) => {
    const lines = text.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
      const row = {};
      headers.forEach((header, idx) => {
        let value = values[idx] || '';
        value = value.replace(/^"|"$/g, '').trim();
        row[header] = value;
      });
      if (Object.keys(row).length > 0) {
        data.push(row);
      }
    }
    return data;
  };

  const handlePOFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPoFile(file);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = parseCSV(event.target.result);
        // Group by PO number
        const poMap = {};
        data.forEach(row => {
          if (!poMap[row.po_number]) {
            poMap[row.po_number] = {
              po_number: row.po_number,
              vendor_name: row.vendor_name,
              receiver_name: row.receiver_name,
              status: row.status,
              grand_total: row.grand_total,
              items: []
            };
          }
          if (row.product_name) {
            poMap[row.po_number].items.push({
              product_name: row.product_name,
              quantity: row.quantity,
              unit_price: row.unit_price
            });
          }
        });
        setPoPreview(Object.values(poMap).slice(0, 5));
      } catch (error) {
        toast.error("Failed to parse file");
      }
    };
    reader.readAsText(file);
  };

  const handleInvoiceFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setInvoiceFile(file);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = parseCSV(event.target.result);
        setInvoicePreview(data.slice(0, 5));
      } catch (error) {
        toast.error("Failed to parse file");
      }
    };
    reader.readAsText(file);
  };

  const handleImportPOs = async () => {
    if (!poFile) {
      toast.error("Please select a file");
      return;
    }

    setImporting(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = parseCSV(event.target.result);
          
          // Get vendors and products
          const [vendorsRes, productsRes] = await Promise.all([
            apiClient.get("/vendors"),
            apiClient.get("/products")
          ]);
          const vendors = vendorsRes.data;
          const products = productsRes.data;
          
          // Group by PO number
          const poMap = {};
          data.forEach(row => {
            if (!poMap[row.po_number]) {
              const vendor = vendors.find(v => v.name.toLowerCase() === (row.vendor_name || '').toLowerCase());
              poMap[row.po_number] = {
                vendor_id: vendor?.id || '',
                delivery_address: row.delivery_address || '',
                receiver_name: row.receiver_name || '',
                contact_person: row.contact_person || '',
                contact_number: row.contact_number || '',
                delivery_date: row.delivery_date || '',
                status: row.status || 'delivered',
                notes: `Imported historical PO`,
                line_items: []
              };
            }
            if (row.product_name) {
              const product = products.find(p => p.name.toLowerCase() === (row.product_name || '').toLowerCase());
              poMap[row.po_number].line_items.push({
                product_id: product?.id || '',
                product_name: row.product_name,
                sku: product?.sku || 'IMPORTED',
                quantity: parseInt(row.quantity) || 1,
                unit_price: parseFloat(row.unit_price) || 0,
                tax_rate: parseFloat(row.tax_rate) || 18,
                discount_amount: 0,
                discount_percent: 0
              });
            }
          });

          let successCount = 0;
          let failCount = 0;
          
          for (const po of Object.values(poMap)) {
            if (!po.vendor_id || po.line_items.length === 0) {
              failCount++;
              continue;
            }
            try {
              await apiClient.post("/purchase-orders/import", po);
              successCount++;
            } catch (err) {
              failCount++;
            }
          }

          setImportResults({
            type: 'po',
            success: successCount,
            failed: failCount
          });
          toast.success(`Imported ${successCount} POs. ${failCount > 0 ? `${failCount} failed.` : ''}`);
          setPoFile(null);
          setPoPreview([]);
        } catch (error) {
          toast.error("Failed to import POs");
        } finally {
          setImporting(false);
        }
      };
      reader.readAsText(poFile);
    } catch (error) {
      toast.error("Failed to read file");
      setImporting(false);
    }
  };

  const handleImportInvoices = async () => {
    if (!invoiceFile) {
      toast.error("Please select a file");
      return;
    }

    setImporting(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = parseCSV(event.target.result);
          
          // Get POs and vendors
          const [posRes, vendorsRes] = await Promise.all([
            apiClient.get("/purchase-orders"),
            apiClient.get("/vendors")
          ]);
          const pos = posRes.data;
          const vendors = vendorsRes.data;

          let successCount = 0;
          let failCount = 0;
          
          for (const row of data) {
            const po = pos.find(p => p.po_number === row.po_number);
            const vendor = vendors.find(v => v.name.toLowerCase() === (row.vendor_name || '').toLowerCase());
            
            if (!po && !vendor) {
              failCount++;
              continue;
            }
            
            try {
              const invoiceData = {
                po_id: po?.id || '',
                vendor_id: vendor?.id || po?.vendor_id || '',
                invoice_number: row.invoice_number,
                invoice_date: row.invoice_date,
                amount: parseFloat(row.amount) || 0,
                logistics_cost: parseFloat(row.logistics_cost) || 0,
                status: row.status || 'pending',
                paid_amount: parseFloat(row.paid_amount) || 0,
                notes: 'Imported historical invoice'
              };
              
              await apiClient.post("/invoices", invoiceData);
              
              // If there's a payment, record it
              if (parseFloat(row.paid_amount) > 0 && row.payment_date) {
                await apiClient.post("/payments", {
                  invoice_id: '', // Will be linked automatically
                  po_id: po?.id || '',
                  amount: parseFloat(row.paid_amount),
                  payment_date: row.payment_date,
                  payment_mode: 'neft',
                  notes: 'Imported historical payment'
                });
              }
              
              successCount++;
            } catch (err) {
              failCount++;
            }
          }

          setImportResults({
            type: 'invoice',
            success: successCount,
            failed: failCount
          });
          toast.success(`Imported ${successCount} invoices. ${failCount > 0 ? `${failCount} failed.` : ''}`);
          setInvoiceFile(null);
          setInvoicePreview([]);
        } catch (error) {
          toast.error("Failed to import invoices");
        } finally {
          setImporting(false);
        }
      };
      reader.readAsText(invoiceFile);
    } catch (error) {
      toast.error("Failed to read file");
      setImporting(false);
    }
  };

  return (
    <div data-testid="bulk-import-page">
      <div className="page-header">
        <h1 className="page-title">Bulk Import</h1>
        <p className="page-subtitle">Import historical purchase orders and invoices</p>
      </div>

      <div className="page-container">
        {/* Import Results Banner */}
        {importResults && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
            importResults.failed === 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'
          }`}>
            {importResults.failed === 0 ? (
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            ) : (
              <AlertCircle className="w-6 h-6 text-amber-600" />
            )}
            <div>
              <p className={`font-medium ${importResults.failed === 0 ? 'text-emerald-800' : 'text-amber-800'}`}>
                Import Complete
              </p>
              <p className={`text-sm ${importResults.failed === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                {importResults.success} {importResults.type === 'po' ? 'POs' : 'invoices'} imported successfully
                {importResults.failed > 0 && `, ${importResults.failed} failed`}
              </p>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="ml-auto"
              onClick={() => setImportResults(null)}
            >
              Dismiss
            </Button>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="po" className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              Purchase Orders
            </TabsTrigger>
            <TabsTrigger value="invoice" className="flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              Invoices
            </TabsTrigger>
          </TabsList>

          {/* PO Import Tab */}
          <TabsContent value="po">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5" />
                  Import Historical Purchase Orders
                </CardTitle>
                <CardDescription>
                  Upload a CSV file with your existing PO data. This is useful for migrating from another system.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Download Sample */}
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-blue-800">Download Sample File</p>
                      <p className="text-sm text-blue-600">Use this template to format your PO data</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={downloadPOSample}>
                      <Download className="w-4 h-4 mr-2" />
                      Download Sample
                    </Button>
                  </div>
                </div>

                {/* File Upload */}
                <div>
                  <Label>Select PO File</Label>
                  <Input
                    ref={poFileRef}
                    type="file"
                    accept=".csv"
                    onChange={handlePOFileChange}
                    className="mt-2"
                  />
                </div>

                {/* Preview */}
                {poPreview.length > 0 && (
                  <div>
                    <Label>Preview</Label>
                    <div className="mt-2 border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            <TableHead className="text-xs">PO Number</TableHead>
                            <TableHead className="text-xs">Vendor</TableHead>
                            <TableHead className="text-xs">Receiver</TableHead>
                            <TableHead className="text-xs">Status</TableHead>
                            <TableHead className="text-xs">Items</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {poPreview.map((row, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="text-xs py-2">{row.po_number}</TableCell>
                              <TableCell className="text-xs py-2">{row.vendor_name}</TableCell>
                              <TableCell className="text-xs py-2">{row.receiver_name}</TableCell>
                              <TableCell className="text-xs py-2">{row.status}</TableCell>
                              <TableCell className="text-xs py-2">{row.items.length} items</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                <Button 
                  onClick={handleImportPOs}
                  disabled={!poFile || importing}
                  className="w-full"
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Import Purchase Orders
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Invoice Import Tab */}
          <TabsContent value="invoice">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5" />
                  Import Historical Invoices
                </CardTitle>
                <CardDescription>
                  Upload a CSV file with your existing invoice data. Link to POs by PO number.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Download Sample */}
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-blue-800">Download Sample File</p>
                      <p className="text-sm text-blue-600">Use this template to format your invoice data</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={downloadInvoiceSample}>
                      <Download className="w-4 h-4 mr-2" />
                      Download Sample
                    </Button>
                  </div>
                </div>

                {/* File Upload */}
                <div>
                  <Label>Select Invoice File</Label>
                  <Input
                    ref={invoiceFileRef}
                    type="file"
                    accept=".csv"
                    onChange={handleInvoiceFileChange}
                    className="mt-2"
                  />
                </div>

                {/* Preview */}
                {invoicePreview.length > 0 && (
                  <div>
                    <Label>Preview</Label>
                    <div className="mt-2 border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            <TableHead className="text-xs">Invoice #</TableHead>
                            <TableHead className="text-xs">PO #</TableHead>
                            <TableHead className="text-xs">Vendor</TableHead>
                            <TableHead className="text-xs">Amount</TableHead>
                            <TableHead className="text-xs">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {invoicePreview.map((row, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="text-xs py-2">{row.invoice_number}</TableCell>
                              <TableCell className="text-xs py-2">{row.po_number}</TableCell>
                              <TableCell className="text-xs py-2">{row.vendor_name}</TableCell>
                              <TableCell className="text-xs py-2">₹{row.amount}</TableCell>
                              <TableCell className="text-xs py-2">{row.status}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                <Button 
                  onClick={handleImportInvoices}
                  disabled={!invoiceFile || importing}
                  className="w-full"
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Import Invoices
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default BulkImport;
