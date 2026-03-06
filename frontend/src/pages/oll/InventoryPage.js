import { useState, useEffect } from "react";
import { apiClient } from "../../App";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Card, CardContent } from "../../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Plus, Search, Package, Edit2, Trash2, Loader2, Warehouse, IndianRupee, BoxesIcon } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = [
  "Electronics",
  "Robotics Kits",
  "Tools & Equipment",
  "Office Supplies",
  "Packaging Materials",
  "Marketing Materials",
  "Furniture",
  "Other"
];

const InventoryPage = () => {
  const [inventory, setInventory] = useState([]);
  const [products, setProducts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  
  // Dialog state
  const [showDialog, setShowDialog] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  
  const [formData, setFormData] = useState({
    product_id: "",
    product_name: "",
    sku: "",
    category: "",
    quantity: "",
    unit_price: "",
    location: "",
    notes: ""
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [inventoryRes, statsRes, productsRes] = await Promise.all([
        apiClient.get("/inventory"),
        apiClient.get("/inventory/summary/stats"),
        apiClient.get("/products")
      ]);
      setInventory(inventoryRes.data);
      setStats(statsRes.data);
      setProducts(productsRes.data);
    } catch (error) {
      toast.error("Failed to fetch inventory");
    } finally {
      setLoading(false);
    }
  };

  const openAddDialog = () => {
    setEditingItem(null);
    setSelectedProductId("");
    setFormData({
      product_id: "",
      product_name: "",
      sku: "",
      category: "",
      quantity: "",
      unit_price: "",
      location: "",
      notes: ""
    });
    setShowDialog(true);
  };

  const openEditDialog = (item) => {
    setEditingItem(item);
    setSelectedProductId(item.product_id || "");
    setFormData({
      product_id: item.product_id || "",
      product_name: item.product_name,
      sku: item.sku || "",
      category: item.category || "",
      quantity: item.quantity.toString(),
      unit_price: item.unit_price.toString(),
      location: item.location || "",
      notes: item.notes || ""
    });
    setShowDialog(true);
  };

  const handleProductSelect = (productId) => {
    setSelectedProductId(productId);
    const product = products.find(p => p.id === productId);
    if (product) {
      setFormData(prev => ({
        ...prev,
        product_id: product.id,
        product_name: product.name,
        sku: product.sku || "",
        category: product.category || "",
        unit_price: product.unit_price?.toString() || ""
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.product_name.trim()) {
      toast.error("Please select a product");
      return;
    }
    if (!formData.quantity || parseInt(formData.quantity) < 0) {
      toast.error("Valid quantity is required");
      return;
    }
    if (!formData.unit_price || parseFloat(formData.unit_price) < 0) {
      toast.error("Valid unit price is required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        product_id: formData.product_id || null,
        product_name: formData.product_name.trim(),
        sku: formData.sku.trim() || null,
        category: formData.category || null,
        quantity: parseInt(formData.quantity),
        unit_price: parseFloat(formData.unit_price),
        location: formData.location.trim() || null,
        notes: formData.notes.trim() || null
      };

      if (editingItem) {
        await apiClient.put(`/inventory/${editingItem.id}`, payload);
        toast.success("Inventory item updated");
      } else {
        await apiClient.post("/inventory", payload);
        toast.success("Inventory item added");
      }
      
      setShowDialog(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save inventory item");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete "${item.product_name}" from inventory?`)) return;
    
    try {
      await apiClient.delete(`/inventory/${item.id}`);
      toast.success("Inventory item deleted");
      fetchData();
    } catch (error) {
      toast.error("Failed to delete inventory item");
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.product_name.toLowerCase().includes(search.toLowerCase()) ||
                         (item.sku && item.sku.toLowerCase().includes(search.toLowerCase())) ||
                         (item.location && item.location.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const uniqueCategories = [...new Set(inventory.map(i => i.category).filter(Boolean))];

  return (
    <div data-testid="inventory-page">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Office Inventory</h1>
            <p className="page-subtitle">Track and manage office products and their values</p>
          </div>
          <Button 
            onClick={openAddDialog}
            className="bg-[#1e3a8a] hover:bg-[#1e40af]"
            data-testid="add-inventory-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Item
          </Button>
        </div>
      </div>

      <div className="page-container">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Package className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.total_items}</p>
                    <p className="text-sm text-slate-500">Total Items</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <BoxesIcon className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.total_quantity}</p>
                    <p className="text-sm text-slate-500">Total Quantity</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                    <IndianRupee className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{formatCurrency(stats.total_value)}</p>
                    <p className="text-sm text-slate-500">Total Value</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                    <Warehouse className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{Object.keys(stats.by_category).length}</p>
                    <p className="text-sm text-slate-500">Categories</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by product name, SKU, or location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              data-testid="search-input"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {uniqueCategories.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Inventory Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
              </div>
            ) : filteredInventory.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-lg font-medium">No inventory items found</p>
                <p className="text-sm">Add items to start tracking your office inventory</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Product Name</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-center">Quantity</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total Value</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInventory.map((item) => (
                    <TableRow key={item.id} data-testid={`inventory-row-${item.id}`}>
                      <TableCell className="font-medium">{item.product_name}</TableCell>
                      <TableCell className="font-mono text-sm text-slate-500">{item.sku || "-"}</TableCell>
                      <TableCell>
                        {item.category ? (
                          <span className="badge bg-slate-100 text-slate-700">{item.category}</span>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="text-center font-medium">{item.quantity}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(item.unit_price)}</TableCell>
                      <TableCell className="text-right font-mono font-medium text-emerald-600">
                        {formatCurrency(item.total_value)}
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">{item.location || "-"}</TableCell>
                      <TableCell className="text-sm text-slate-500">{formatDate(item.updated_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(item)}
                            className="text-blue-600 hover:bg-blue-50"
                            data-testid={`edit-${item.id}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(item)}
                            className="text-red-600 hover:bg-red-50"
                            data-testid={`delete-${item.id}`}
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
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        {stats && Object.keys(stats.by_category).length > 0 && (
          <Card className="mt-6">
            <CardContent className="p-6">
              <h3 className="font-semibold text-slate-700 mb-4">Inventory by Category</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(stats.by_category).map(([category, data]) => (
                  <div key={category} className="p-4 bg-slate-50 rounded-lg">
                    <h4 className="font-medium text-slate-800">{category}</h4>
                    <div className="mt-2 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Items:</span>
                        <span className="font-medium">{data.count}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Quantity:</span>
                        <span className="font-medium">{data.quantity}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Value:</span>
                        <span className="font-mono font-medium text-emerald-600">{formatCurrency(data.value)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Edit Inventory Item" : "Add Inventory Item"}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Product Selection */}
            <div>
              <Label htmlFor="product">Select Product *</Label>
              <Select 
                value={selectedProductId} 
                onValueChange={handleProductSelect}
                disabled={editingItem !== null}
              >
                <SelectTrigger data-testid="product-select">
                  <SelectValue placeholder="Choose a product from the list" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} {product.sku ? `(${product.sku})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editingItem && (
                <p className="text-xs text-slate-500 mt-1">Product cannot be changed while editing</p>
              )}
            </div>

            {/* Show selected product info */}
            {formData.product_name && (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-blue-600">Product:</span>
                    <span className="ml-2 font-medium">{formData.product_name}</span>
                  </div>
                  {formData.sku && (
                    <div>
                      <span className="text-blue-600">SKU:</span>
                      <span className="ml-2 font-mono">{formData.sku}</span>
                    </div>
                  )}
                  {formData.category && (
                    <div>
                      <span className="text-blue-600">Category:</span>
                      <span className="ml-2">{formData.category}</span>
                    </div>
                  )}
                  {formData.unit_price && (
                    <div>
                      <span className="text-blue-600">Unit Price:</span>
                      <span className="ml-2 font-mono">{formatCurrency(parseFloat(formData.unit_price))}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="quantity">Quantity *</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="0"
                  value={formData.quantity}
                  onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                  placeholder="0"
                  data-testid="quantity-input"
                />
              </div>
              <div>
                <Label htmlFor="unit_price">Unit Price (₹) *</Label>
                <Input
                  id="unit_price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.unit_price}
                  onChange={(e) => setFormData(prev => ({ ...prev, unit_price: e.target.value }))}
                  placeholder="0.00"
                  data-testid="unit-price-input"
                />
              </div>
            </div>

            {formData.quantity && formData.unit_price && (
              <div className="p-3 bg-emerald-50 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-emerald-700 font-medium">Total Value:</span>
                  <span className="text-xl font-bold text-emerald-600 font-mono">
                    {formatCurrency(parseInt(formData.quantity) * parseFloat(formData.unit_price))}
                  </span>
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="location">Storage Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                placeholder="e.g., Office Shelf A, Warehouse Rack 3"
              />
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional details about this item..."
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="bg-[#1e3a8a] hover:bg-[#1e40af]"
                disabled={saving}
                data-testid="save-inventory-btn"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  editingItem ? "Update Item" : "Add Item"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InventoryPage;
