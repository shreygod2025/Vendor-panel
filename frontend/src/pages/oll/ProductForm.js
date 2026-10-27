import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "../../App";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Switch } from "../../components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { ArrowLeft, Save, Loader2, Upload, X, ImageIcon } from "lucide-react";
import { toast } from "sonner";

const PRODUCT_CATEGORIES = [
  "Curriculum Books",
  "Curriculum Robotic Kits",
  "Competition Kits",
  "Individual Components",
];

const ProductForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef(null);
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    vendor_id: "",
    category: "",
    unit_price: "",
    tax_rate: "18",
    description: "",
    unit: "pcs",
    is_active: true,
    in_stock: true,
    image_url: "",
    show_on_shop: false,
    mrp: "",
    // Shop-only enriched fields
    shop_images: [],
    shop_videos: [],
    youtube_url: "",
    kit_includes: [], // [{name, quantity}]
    dim_length: "",
    dim_breadth: "",
    dim_height: "",
    dim_unit: "cm",
    dim_weight: "",
    dim_weight_unit: "g",
    additional_info: ""
  });

  useEffect(() => {
    fetchVendors();
    if (isEdit) {
      fetchProduct();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchVendors = async () => {
    try {
      const response = await apiClient.get("/vendors?is_active=true");
      setVendors(response.data);
    } catch (error) {
      toast.error("Failed to fetch vendors");
    }
  };

  const fetchProduct = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/products/${id}`);
      const p = response.data;
      setFormData({
        name: p.name || "",
        sku: p.sku || "",
        vendor_id: p.vendor_id || "",
        category: p.category || "",
        unit_price: p.unit_price != null ? p.unit_price.toString() : "",
        tax_rate: p.tax_rate != null ? p.tax_rate.toString() : "18",
        description: p.description || "",
        unit: p.unit || "pcs",
        is_active: p.is_active !== false,
        in_stock: p.in_stock !== false,
        image_url: p.image_url || "",
        show_on_shop: Boolean(p.show_on_shop),
        mrp: p.mrp != null ? p.mrp.toString() : "",
        shop_images: Array.isArray(p.shop_images) ? p.shop_images : [],
        shop_videos: Array.isArray(p.shop_videos) ? p.shop_videos : [],
        youtube_url: p.youtube_url || "",
        kit_includes: Array.isArray(p.kit_includes) ? p.kit_includes : [],
        dim_length: p.dimensions?.length != null ? String(p.dimensions.length) : "",
        dim_breadth: p.dimensions?.breadth != null ? String(p.dimensions.breadth) : "",
        dim_height: p.dimensions?.height != null ? String(p.dimensions.height) : "",
        dim_unit: p.dimensions?.unit || "cm",
        dim_weight: p.dimensions?.weight != null ? String(p.dimensions.weight) : "",
        dim_weight_unit: p.dimensions?.weight_unit || "g",
        additional_info: p.additional_info || ""
      });
    } catch (error) {
      toast.error("Failed to fetch product");
      navigate("/oll/products");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    setUploadingImage(true);
    try {
      const uploadFormData = new FormData();
      uploadFormData.append("file", file);
      const res = await apiClient.post("/upload", uploadFormData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      const url = res?.data?.url;
      if (!url) {
        console.error("Upload returned no url:", res?.data);
        toast.error("Upload succeeded but no URL returned. Check backend APP_BASE_URL.");
        return;
      }
      setFormData((prev) => ({ ...prev, image_url: url }));
      toast.success("Image uploaded");
    } catch (err) {
      console.error("Image upload failed:", err?.response?.status, err?.response?.data, err);
      toast.error(err.response?.data?.detail || `Failed to upload image (${err?.response?.status || "network"})`);
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  const handleRemoveImage = () => {
    setFormData((prev) => ({ ...prev, image_url: "" }));
  };

  // Multi-image gallery upload (for the shop-only "Shop Images" section)
  const galleryInputRef = useRef(null);
  const [uploadingGallery, setUploadingGallery] = useState(false);

  const handleGalleryUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const invalid = files.find(f => !f.type.startsWith("image/"));
    if (invalid) {
      toast.error("Only image files are allowed");
      return;
    }
    setUploadingGallery(true);
    try {
      const uploaded = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await apiClient.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
        if (res?.data?.url) uploaded.push(res.data.url);
      }
      if (uploaded.length) {
        setFormData((prev) => ({ ...prev, shop_images: [...prev.shop_images, ...uploaded] }));
        toast.success(`${uploaded.length} image(s) added`);
      }
    } catch (err) {
      console.error("Gallery upload failed:", err?.response?.status, err?.response?.data, err);
      toast.error(err.response?.data?.detail || "Failed to upload one or more images");
    } finally {
      setUploadingGallery(false);
      if (galleryInputRef.current) galleryInputRef.current.value = "";
    }
  };

  const removeGalleryImage = (url) => {
    setFormData((prev) => ({ ...prev, shop_images: prev.shop_images.filter(u => u !== url) }));
  };

  // Video URL list helpers
  const [videoDraft, setVideoDraft] = useState("");
  const addVideoUrl = () => {
    const url = videoDraft.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      toast.error("Please enter a valid URL (starts with http:// or https://)");
      return;
    }
    if (formData.shop_videos.includes(url)) {
      toast.error("This URL is already in the list");
      return;
    }
    setFormData((prev) => ({ ...prev, shop_videos: [...prev.shop_videos, url] }));
    setVideoDraft("");
  };
  const removeVideoUrl = (url) => {
    setFormData((prev) => ({ ...prev, shop_videos: prev.shop_videos.filter(u => u !== url) }));
  };

  // Kit includes helpers
  const addKitRow = () => {
    setFormData((prev) => ({ ...prev, kit_includes: [...prev.kit_includes, { name: "", quantity: 1 }] }));
  };
  const updateKitRow = (idx, field, value) => {
    setFormData((prev) => {
      const next = [...prev.kit_includes];
      next[idx] = { ...next[idx], [field]: field === "quantity" ? (parseInt(value, 10) || 0) : value };
      return { ...prev, kit_includes: next };
    });
  };
  const removeKitRow = (idx) => {
    setFormData((prev) => ({ ...prev, kit_includes: prev.kit_includes.filter((_, i) => i !== idx) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.show_on_shop) {
      const mrpNum = parseFloat(formData.mrp);
      if (!formData.mrp || isNaN(mrpNum) || mrpNum <= 0) {
        toast.error("MRP is required when 'Show on Shop' is enabled");
        return;
      }
    }

    setSaving(true);

    // Build dimensions object only if the user supplied at least one measurement
    const anyDim = ["dim_length", "dim_breadth", "dim_height", "dim_weight"].some(k => formData[k] !== "" && formData[k] != null);
    const dimensions = anyDim ? {
      length: formData.dim_length !== "" ? parseFloat(formData.dim_length) : null,
      breadth: formData.dim_breadth !== "" ? parseFloat(formData.dim_breadth) : null,
      height: formData.dim_height !== "" ? parseFloat(formData.dim_height) : null,
      unit: formData.dim_unit,
      weight: formData.dim_weight !== "" ? parseFloat(formData.dim_weight) : null,
      weight_unit: formData.dim_weight_unit
    } : null;

    const cleanKit = (formData.kit_includes || []).filter(r => r.name && r.name.trim());

    const payload = {
      name: formData.name,
      sku: formData.sku,
      vendor_id: formData.vendor_id,
      category: formData.category || null,
      unit_price: parseFloat(formData.unit_price),
      tax_rate: parseFloat(formData.tax_rate),
      description: formData.description || null,
      unit: formData.unit,
      is_active: formData.is_active,
      in_stock: formData.in_stock,
      image_url: formData.image_url || null,
      show_on_shop: formData.show_on_shop,
      mrp: formData.show_on_shop && formData.mrp ? parseFloat(formData.mrp) : null,
      // Shop-only enriched fields — always sent so toggling off also clears them.
      shop_images: formData.show_on_shop ? formData.shop_images : [],
      shop_videos: formData.show_on_shop ? formData.shop_videos : [],
      youtube_url: formData.show_on_shop ? (formData.youtube_url || null) : null,
      kit_includes: formData.show_on_shop ? cleanKit : [],
      dimensions: formData.show_on_shop ? dimensions : null,
      additional_info: formData.show_on_shop ? (formData.additional_info || null) : null
    };

    try {
      if (isEdit) {
        await apiClient.put(`/products/${id}`, payload);
        toast.success("Product updated successfully");
      } else {
        await apiClient.post("/products", payload);
        toast.success("Product created successfully");
      }
      navigate("/oll/products");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <div data-testid="product-form-page">
      <div className="page-header">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/oll/products")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="page-title">{isEdit ? "Edit Product" : "Add Product"}</h1>
            <p className="page-subtitle">
              {isEdit ? "Update product information" : "Add a new product"}
            </p>
          </div>
        </div>
      </div>

      <div className="page-container">
        <form onSubmit={handleSubmit}>
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle>Product Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name" className="form-label">Product Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    data-testid="product-name-input"
                  />
                </div>
                <div>
                  <Label htmlFor="sku" className="form-label">SKU / Product ID *</Label>
                  <Input
                    id="sku"
                    name="sku"
                    value={formData.sku}
                    onChange={handleChange}
                    required
                    placeholder="e.g., PUMP-A100"
                    data-testid="product-sku-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="vendor_id" className="form-label">Vendor *</Label>
                  <Select 
                    value={formData.vendor_id} 
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, vendor_id: value }))}
                  >
                    <SelectTrigger data-testid="product-vendor-select">
                      <SelectValue placeholder="Select a vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      {vendors.map((vendor) => (
                        <SelectItem key={vendor.id} value={vendor.id}>{vendor.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="category" className="form-label">Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, category: value }))}
                  >
                    <SelectTrigger data-testid="product-category-select">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRODUCT_CATEGORIES.map((category) => (
                        <SelectItem key={category} value={category}>{category}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="unit_price" className="form-label">Unit Price (₹) *</Label>
                  <Input
                    id="unit_price"
                    name="unit_price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.unit_price}
                    onChange={handleChange}
                    required
                    data-testid="product-price-input"
                  />
                </div>
                <div>
                  <Label htmlFor="tax_rate" className="form-label">Tax Rate (GST %) *</Label>
                  <Select 
                    value={formData.tax_rate} 
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, tax_rate: value }))}
                  >
                    <SelectTrigger data-testid="product-tax-select">
                      <SelectValue placeholder="Select tax rate" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0% (Exempt)</SelectItem>
                      <SelectItem value="5">5% GST</SelectItem>
                      <SelectItem value="12">12% GST</SelectItem>
                      <SelectItem value="18">18% GST</SelectItem>
                      <SelectItem value="28">28% GST</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="unit" className="form-label">Unit *</Label>
                  <Select 
                    value={formData.unit} 
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, unit: value }))}
                  >
                    <SelectTrigger data-testid="product-unit-select">
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pcs">Pieces (pcs)</SelectItem>
                      <SelectItem value="kg">Kilograms (kg)</SelectItem>
                      <SelectItem value="ltr">Liters (ltr)</SelectItem>
                      <SelectItem value="mtr">Meters (mtr)</SelectItem>
                      <SelectItem value="box">Box</SelectItem>
                      <SelectItem value="set">Set</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="description" className="form-label">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Brief description of the product. Supports Markdown — use '- item' for bullets, **bold**, *italic*"
                  data-testid="product-description-input"
                />
              </div>

              {/* Product Image */}
              <div>
                <Label className="form-label">Product Image</Label>
                {formData.image_url ? (
                  <div className="relative inline-block">
                    <img
                      src={formData.image_url}
                      alt="Product"
                      className="w-40 h-40 object-cover rounded-lg border border-slate-200"
                      data-testid="product-image-preview"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-md"
                      title="Remove image"
                      data-testid="remove-product-image-btn"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => imageInputRef.current?.click()}
                    data-testid="product-image-drop-zone"
                  >
                    {uploadingImage ? (
                      <div className="flex items-center justify-center gap-2 text-slate-600">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Uploading...
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-slate-500">
                        <ImageIcon className="w-8 h-8" />
                        <p className="text-sm font-medium">Click to upload product image</p>
                        <p className="text-xs">PNG, JPG, or WebP (max 10MB)</p>
                      </div>
                    )}
                  </div>
                )}
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleImageUpload}
                  data-testid="product-image-input"
                />
                {formData.image_url && !uploadingImage && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => imageInputRef.current?.click()}
                    data-testid="replace-product-image-btn"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Replace Image
                  </Button>
                )}
              </div>

              {/* Show on Shop Toggle */}
              <div className="flex items-center justify-between py-3 px-4 bg-blue-50 rounded-lg">
                <div>
                  <p className="font-medium text-slate-900">Show on Shop</p>
                  <p className="text-sm text-slate-500">Make this product visible in the public shop</p>
                </div>
                <Switch
                  checked={formData.show_on_shop}
                  onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, show_on_shop: checked }))}
                  data-testid="product-show-on-shop-switch"
                />
              </div>

              {/* MRP Input — only when Show on Shop is enabled */}
              {formData.show_on_shop && (
                <div data-testid="product-mrp-section">
                  <Label htmlFor="mrp" className="form-label">MRP (₹) *</Label>
                  <Input
                    id="mrp"
                    name="mrp"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.mrp}
                    onChange={handleChange}
                    required={formData.show_on_shop}
                    placeholder="Maximum Retail Price"
                    data-testid="product-mrp-input"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Required when the product is listed on the shop.
                  </p>
                </div>
              )}

              {/* Shop-only enriched details */}
              {formData.show_on_shop && (
                <div className="space-y-6 p-5 border border-blue-100 bg-blue-50/40 rounded-lg" data-testid="product-shop-details-section">
                  <div className="flex items-center gap-2 pb-2 border-b border-blue-100">
                    <h3 className="text-base font-semibold text-slate-900">Shop Details</h3>
                    <span className="text-xs text-slate-500">(surfaced to the public shop + external API)</span>
                  </div>

                  {/* Gallery (multiple images) */}
                  <div>
                    <Label className="form-label">Gallery Images</Label>
                    <div className="flex flex-wrap gap-3">
                      {formData.shop_images.map((url) => (
                        <div key={url} className="relative" data-testid={`shop-image-${url.slice(-10)}`}>
                          <img src={url} alt="Gallery" className="w-20 h-20 object-cover rounded-md border border-slate-200" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                          <button type="button" onClick={() => removeGalleryImage(url)} className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5" title="Remove">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => galleryInputRef.current?.click()}
                        className="w-20 h-20 border-2 border-dashed border-slate-300 rounded-md flex flex-col items-center justify-center text-slate-500 hover:bg-slate-50"
                        data-testid="shop-gallery-upload-btn"
                      >
                        {uploadingGallery ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Upload className="w-5 h-5" /><span className="text-xs mt-1">Add</span></>}
                      </button>
                      <input ref={galleryInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleGalleryUpload} />
                    </div>
                  </div>

                  {/* YouTube URL */}
                  <div>
                    <Label htmlFor="youtube_url" className="form-label">YouTube Video Link</Label>
                    <Input
                      id="youtube_url"
                      name="youtube_url"
                      type="url"
                      value={formData.youtube_url}
                      onChange={handleChange}
                      placeholder="https://www.youtube.com/watch?v=..."
                      data-testid="product-youtube-input"
                    />
                  </div>

                  {/* Additional video URLs */}
                  <div>
                    <Label className="form-label">Additional Video URLs</Label>
                    <div className="flex gap-2">
                      <Input
                        value={videoDraft}
                        onChange={(e) => setVideoDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addVideoUrl(); } }}
                        placeholder="https://..."
                        data-testid="shop-video-url-input"
                      />
                      <Button type="button" variant="outline" onClick={addVideoUrl} data-testid="shop-video-url-add">Add</Button>
                    </div>
                    {formData.shop_videos.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {formData.shop_videos.map((url) => (
                          <div key={url} className="flex items-center justify-between bg-white rounded px-2 py-1 border text-sm">
                            <span className="truncate text-blue-700">{url}</span>
                            <button type="button" onClick={() => removeVideoUrl(url)} className="text-red-500 hover:text-red-700" title="Remove">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Kit Includes */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="form-label mb-0">What's in the Kit</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addKitRow} data-testid="kit-add-row-btn">
                        + Add Item
                      </Button>
                    </div>
                    {formData.kit_includes.length === 0 ? (
                      <p className="text-sm text-slate-500 text-center py-3 border-2 border-dashed border-slate-200 rounded">No items yet. Click "+ Add Item" to list what's included.</p>
                    ) : (
                      <div className="space-y-2">
                        {formData.kit_includes.map((row, idx) => (
                          <div key={idx} className="flex gap-2 items-center" data-testid={`kit-row-${idx}`}>
                            <Input
                              value={row.name}
                              onChange={(e) => updateKitRow(idx, "name", e.target.value)}
                              placeholder="e.g. Arduino Uno R3"
                              className="flex-1"
                              data-testid={`kit-name-${idx}`}
                            />
                            <Input
                              type="number"
                              min="0"
                              value={row.quantity}
                              onChange={(e) => updateKitRow(idx, "quantity", e.target.value)}
                              placeholder="Qty"
                              className="w-24"
                              data-testid={`kit-qty-${idx}`}
                            />
                            <button type="button" onClick={() => removeKitRow(idx)} className="text-red-500 hover:text-red-700 px-2" title="Remove row" data-testid={`kit-remove-${idx}`}>
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Dimensions */}
                  <div>
                    <Label className="form-label">Measurements</Label>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                      <Input type="number" step="0.01" min="0" value={formData.dim_length} onChange={(e) => setFormData((p) => ({ ...p, dim_length: e.target.value }))} placeholder="Length" data-testid="product-length-input" />
                      <Input type="number" step="0.01" min="0" value={formData.dim_breadth} onChange={(e) => setFormData((p) => ({ ...p, dim_breadth: e.target.value }))} placeholder="Breadth" data-testid="product-breadth-input" />
                      <Input type="number" step="0.01" min="0" value={formData.dim_height} onChange={(e) => setFormData((p) => ({ ...p, dim_height: e.target.value }))} placeholder="Height" data-testid="product-height-input" />
                      <Select value={formData.dim_unit} onValueChange={(v) => setFormData((p) => ({ ...p, dim_unit: v }))}>
                        <SelectTrigger data-testid="product-dim-unit-select"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cm">cm</SelectItem>
                          <SelectItem value="mm">mm</SelectItem>
                          <SelectItem value="inch">inch</SelectItem>
                          <SelectItem value="m">m</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mt-2">
                      <Input type="number" step="0.01" min="0" value={formData.dim_weight} onChange={(e) => setFormData((p) => ({ ...p, dim_weight: e.target.value }))} placeholder="Weight" className="md:col-span-3" data-testid="product-weight-input" />
                      <Select value={formData.dim_weight_unit} onValueChange={(v) => setFormData((p) => ({ ...p, dim_weight_unit: v }))}>
                        <SelectTrigger data-testid="product-weight-unit-select"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="g">g</SelectItem>
                          <SelectItem value="kg">kg</SelectItem>
                          <SelectItem value="lb">lb</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Additional info */}
                  <div>
                    <Label htmlFor="additional_info" className="form-label">Additional Information</Label>
                    <Textarea
                      id="additional_info"
                      name="additional_info"
                      value={formData.additional_info}
                      onChange={handleChange}
                      rows={3}
                      placeholder="Any extra product notes — supports Markdown (- bullet, **bold**, *italic*)"
                      data-testid="product-additional-info-input"
                    />
                    <p className="text-xs text-slate-500 mt-1">Also supported in the Description field above. Example: <code className="text-xs bg-slate-100 px-1 rounded">- Feature one</code></p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between py-3 px-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div>
                    <p className="font-medium text-slate-900">Active Status</p>
                    <p className="text-sm text-slate-500">Enable or disable this product</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${formData.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                      {formData.is_active ? "Active" : "Inactive"}
                    </span>
                    <Switch
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, is_active: checked }))}
                      data-testid="product-active-switch"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between py-3 px-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div>
                    <p className="font-medium text-slate-900">Stock Availability</p>
                    <p className="text-sm text-slate-500">
                      {formData.in_stock ? "Currently In Stock" : "Currently Out of Stock"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${formData.in_stock ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                      {formData.in_stock ? "In Stock" : "Out of Stock"}
                    </span>
                    <Switch
                      checked={formData.in_stock}
                      onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, in_stock: checked }))}
                      data-testid="product-stock-switch"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/oll/products")}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-[#1e3a8a] hover:bg-[#1e40af]"
                  disabled={saving}
                  data-testid="save-product-btn"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      {isEdit ? "Update Product" : "Create Product"}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  );
};

export default ProductForm;
