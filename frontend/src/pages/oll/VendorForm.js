import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "../../App";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Switch } from "../../components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

const VendorForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    gst_number: "",
    contact_person: "",
    is_active: true
  });

  useEffect(() => {
    if (isEdit) {
      fetchVendor();
    }
  }, [id]);

  const fetchVendor = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/vendors/${id}`);
      setFormData(response.data);
    } catch (error) {
      toast.error("Failed to fetch vendor");
      navigate("/oll/vendors");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (isEdit) {
        await apiClient.put(`/vendors/${id}`, formData);
        toast.success("Vendor updated successfully");
      } else {
        await apiClient.post("/vendors", formData);
        toast.success("Vendor created successfully");
      }
      navigate("/oll/vendors");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save vendor");
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
    <div data-testid="vendor-form-page">
      <div className="page-header">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/oll/vendors")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="page-title">{isEdit ? "Edit Vendor" : "Add Vendor"}</h1>
            <p className="page-subtitle">
              {isEdit ? "Update vendor information" : "Add a new vendor to your database"}
            </p>
          </div>
        </div>
      </div>

      <div className="page-container">
        <form onSubmit={handleSubmit}>
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle>Vendor Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name" className="form-label">Company Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    data-testid="vendor-name-input"
                  />
                </div>
                <div>
                  <Label htmlFor="contact_person" className="form-label">Contact Person</Label>
                  <Input
                    id="contact_person"
                    name="contact_person"
                    value={formData.contact_person}
                    onChange={handleChange}
                    data-testid="vendor-contact-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email" className="form-label">Email *</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    data-testid="vendor-email-input"
                  />
                </div>
                <div>
                  <Label htmlFor="phone" className="form-label">Phone *</Label>
                  <Input
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    data-testid="vendor-phone-input"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="gst_number" className="form-label">GST Number</Label>
                <Input
                  id="gst_number"
                  name="gst_number"
                  value={formData.gst_number}
                  onChange={handleChange}
                  placeholder="e.g., 27AABCU9603R1ZM"
                  data-testid="vendor-gst-input"
                />
              </div>

              <div>
                <Label htmlFor="address" className="form-label">Address *</Label>
                <Textarea
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  rows={3}
                  required
                  data-testid="vendor-address-input"
                />
              </div>

              <div className="flex items-center justify-between py-3 px-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-medium text-slate-900">Active Status</p>
                  <p className="text-sm text-slate-500">Enable or disable this vendor</p>
                </div>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, is_active: checked }))}
                  data-testid="vendor-active-switch"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/oll/vendors")}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-[#1e3a8a] hover:bg-[#1e40af]"
                  disabled={saving}
                  data-testid="save-vendor-btn"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      {isEdit ? "Update Vendor" : "Create Vendor"}
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

export default VendorForm;
