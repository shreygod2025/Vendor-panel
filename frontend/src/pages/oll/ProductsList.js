import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../App";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../components/ui/dialog";
import { Plus, Search, Edit, Trash2, Package, Upload, Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";

const ProductsList = () => {
  const [products, setProducts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  
  // Import dialog state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [productsRes, vendorsRes] = await Promise.all([
        apiClient.get("/products"),
        apiClient.get("/vendors")
      ]);
      setProducts(productsRes.data);
      setVendors(vendorsRes.data);
    } catch (error) {
      toast.error("Failed to fetch products");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this product?")) return;
    
    try {
      await apiClient.delete(`/products/${id}`);
      toast.success("Product deleted successfully");
      fetchData();
    } catch (error) {
      toast.error("Failed to delete product");
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  // Download sample CSV
  const downloadSampleFile = () => {
    const sampleData = `name,sku,vendor_name,unit_price,tax_rate,description,is_active
"Industrial Motor A1",SKU-MOTOR-001,"Tech Components Pvt Ltd",15000,18,"High performance industrial motor",true
"Steel Bearings Set",SKU-BEAR-002,"Tech Components Pvt Ltd",3500,18,"Premium steel bearings pack of 10",true
"Control Panel Unit",SKU-CTRL-003,"Supreme Electricals",25000,18,"Advanced control panel with LCD display",true
"Copper Wire Bundle",SKU-WIRE-004,"Supreme Electricals",8000,18,"100m copper wire bundle",true`;

    const blob = new Blob([sampleData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'products_sample.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    toast.success("Sample file downloaded");
  };

  // Parse CSV file
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
        if (header === 'unit_price' || header === 'tax_rate') {
          value = parseFloat(value) || 0;
        }
        if (header === 'is_active') {
          value = value.toLowerCase() === 'true';
        }
        row[header] = value;
      });
      if (row.name && row.sku) {
        data.push(row);
      }
    }
    return data;
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.xlsx')) {
      toast.error("Please upload a CSV or XLSX file");
      return;
    }

    setImportFile(file);
    
    // Parse and preview
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = parseCSV(event.target.result);
        setImportPreview(data.slice(0, 5)); // Preview first 5 rows
      } catch (error) {
        toast.error("Failed to parse file");
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!importFile) {
      toast.error("Please select a file");
      return;
    }

    setImporting(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = parseCSV(event.target.result);
          
          if (data.length === 0) {
            toast.error("No valid data found in file");
            setImporting(false);
            return;
          }
          
          // Prepare products for bulk import
          const productsToImport = data.map(row => ({
            name: row.name || '',
            sku: row.sku || '',
            vendor_name: row.vendor_name || '',
            unit_price: parseFloat(row.unit_price) || 0,
            tax_rate: parseFloat(row.tax_rate) || 18,
            description: row.description || '',
            is_active: row.is_active !== 'false' && row.is_active !== false
          })).filter(p => p.name && p.sku && p.vendor_name);

          if (productsToImport.length === 0) {
            toast.error("No valid products found. Ensure name, sku, and vendor_name columns are filled.");
            setImporting(false);
            return;
          }

          // Call bulk import endpoint
          const response = await apiClient.post("/products/import", {
            products: productsToImport
          });

          if (response.data.success_count > 0) {
            toast.success(response.data.message);
          } else {
            toast.error(response.data.message || "Import failed");
          }
          
          // Show errors if any
          if (response.data.errors && response.data.errors.length > 0) {
            console.log("Import errors:", response.data.errors);
          }

          setImportDialogOpen(false);
          setImportFile(null);
          setImportPreview([]);
          fetchData();
        } catch (error) {
          console.error("Import error:", error);
          toast.error(error.response?.data?.detail || "Failed to import products");
        } finally {
          setImporting(false);
        }
      };
      reader.readAsText(importFile);
    } catch (error) {
      toast.error("Failed to read file");
      setImporting(false);
    }
  };

  const filteredProducts = products.filter((product) => {
    const matchesSearch = 
      product.name.toLowerCase().includes(search.toLowerCase()) ||
      product.sku.toLowerCase().includes(search.toLowerCase());
    const matchesVendor = vendorFilter === "all" || product.vendor_id === vendorFilter;
    const matchesStatus = 
      statusFilter === "all" || 
      (statusFilter === "active" && product.is_active) ||
      (statusFilter === "inactive" && !product.is_active);
    return matchesSearch && matchesVendor && matchesStatus;
  });

  return (
    <div data-testid="products-list-page">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Products</h1>
            <p className="page-subtitle">Manage products from all vendors</p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              onClick={() => setImportDialogOpen(true)}
              data-testid="import-products-btn"
            >
              <Upload className="w-4 h-4 mr-2" />
              Import Products
            </Button>
            <Link to="/oll/products/new">
              <Button className="bg-[#1e3a8a] hover:bg-[#1e40af]" data-testid="add-product-btn">
                <Plus className="w-4 h-4 mr-2" />
                Add Product
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="page-container">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              data-testid="search-input"
            />
          </div>
          <Select value={vendorFilter} onValueChange={setVendorFilter}>
            <SelectTrigger className="w-[200px]" data-testid="vendor-filter">
              <SelectValue placeholder="Filter by vendor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vendors</SelectItem>
              {vendors.map((vendor) => (
                <SelectItem key={vendor.id} value={vendor.id}>{vendor.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]" data-testid="status-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="empty-state py-12">
              <Package className="empty-state-icon" />
              <p className="empty-state-title">No products found</p>
              <p className="empty-state-text">Get started by adding your first product</p>
              <div className="flex gap-3 mt-4 justify-center">
                <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
                  <Upload className="w-4 h-4 mr-2" />
                  Import Products
                </Button>
                <Link to="/oll/products/new">
                  <Button>Add Product</Button>
                </Link>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Unit Price</TableHead>
                  <TableHead>Tax Rate</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.id} data-testid={`product-row-${product.id}`}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-slate-900">{product.name}</p>
                        {product.description && (
                          <p className="text-xs text-slate-500 truncate max-w-[200px]">{product.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">{product.sku}</span>
                    </TableCell>
                    <TableCell>{product.vendor_name}</TableCell>
                    <TableCell className="font-mono">{formatCurrency(product.unit_price)}</TableCell>
                    <TableCell>{product.tax_rate}%</TableCell>
                    <TableCell>
                      <span className={`badge ${product.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {product.is_active ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link to={`/oll/products/${product.id}/edit`}>
                          <Button variant="ghost" size="sm" data-testid={`edit-product-${product.id}`}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(product.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          data-testid={`delete-product-${product.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Import Products Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Import Products
            </DialogTitle>
            <DialogDescription>
              Upload a CSV or XLSX file to import multiple products at once
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Download Sample */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-blue-800">Download Sample File</p>
                  <p className="text-sm text-blue-600">Use this template to format your data correctly</p>
                </div>
                <Button variant="outline" size="sm" onClick={downloadSampleFile}>
                  <Download className="w-4 h-4 mr-2" />
                  Download Sample
                </Button>
              </div>
            </div>

            {/* File Upload */}
            <div>
              <Label>Select File</Label>
              <div className="mt-2">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={handleFileChange}
                  className="cursor-pointer"
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">Supported formats: CSV, XLSX</p>
            </div>

            {/* Preview */}
            {importPreview.length > 0 && (
              <div>
                <Label>Preview (first 5 rows)</Label>
                <div className="mt-2 border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="text-xs">Name</TableHead>
                        <TableHead className="text-xs">SKU</TableHead>
                        <TableHead className="text-xs">Vendor</TableHead>
                        <TableHead className="text-xs">Price</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importPreview.map((row, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-xs py-2">{row.name}</TableCell>
                          <TableCell className="text-xs py-2">{row.sku}</TableCell>
                          <TableCell className="text-xs py-2">{row.vendor_name}</TableCell>
                          <TableCell className="text-xs py-2">₹{row.unit_price}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {importPreview.length} rows found. Vendor names must match existing vendors.
                </p>
              </div>
            )}

            {/* Required columns info */}
            <div className="text-xs text-slate-500">
              <p className="font-medium text-slate-700 mb-1">Required columns:</p>
              <p>name, sku, vendor_name, unit_price, tax_rate</p>
              <p className="mt-1">Optional: description, is_active</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setImportDialogOpen(false);
              setImportFile(null);
              setImportPreview([]);
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handleImport}
              disabled={!importFile || importing}
              className="bg-[#1e3a8a] hover:bg-[#1e40af]"
            >
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Import Products
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductsList;
