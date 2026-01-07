import { useState, useEffect } from "react";
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
import { ArrowLeft, Save, Loader2, Plus, Trash2, Users, Building } from "lucide-react";
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
    is_active: true,
    bank_details: {
      bank_name: "",
      branch: "",
      ifsc_code: "",
      account_number: "",
      account_holder_name: "",
      cancel_cheque_url: ""
    },
    team_members: []
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
      setFormData({
        ...response.data,
        bank_details: response.data.bank_details || {
          bank_name: "",
          branch: "",
          ifsc_code: "",
          account_number: "",
          account_holder_name: "",
          cancel_cheque_url: ""
        },
        team_members: response.data.team_members || []
      });
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

  const handleBankChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      bank_details: { ...prev.bank_details, [field]: value }
    }));
  };

  const addTeamMember = () => {
    setFormData((prev) => ({
      ...prev,
      team_members: [...prev.team_members, {
        id: `temp-${Date.now()}`,
        name: "",
        phone: "",
        email: "",
        role: "coordinator"
      }]
    }));
  };

  const removeTeamMember = (index) => {
    setFormData((prev) => ({
      ...prev,
      team_members: prev.team_members.filter((_, i) => i !== index)
    }));
  };

  const updateTeamMember = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      team_members: prev.team_members.map((member, i) =>
        i === index ? { ...member, [field]: value } : member
      )
    }));
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
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="w-5 h-5" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                  <Label htmlFor="contact_person" className="form-label">Primary Contact Person</Label>
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
            </CardContent>
          </Card>

          {/* Bank Details */}
          <Card>
            <CardHeader>
              <CardTitle>Bank Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="form-label">Bank Name</Label>
                  <Input
                    value={formData.bank_details.bank_name}
                    onChange={(e) => handleBankChange("bank_name", e.target.value)}
                    placeholder="e.g., HDFC Bank"
                  />
                </div>
                <div>
                  <Label className="form-label">Branch</Label>
                  <Input
                    value={formData.bank_details.branch}
                    onChange={(e) => handleBankChange("branch", e.target.value)}
                    placeholder="e.g., Andheri West"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="form-label">IFSC Code</Label>
                  <Input
                    value={formData.bank_details.ifsc_code}
                    onChange={(e) => handleBankChange("ifsc_code", e.target.value.toUpperCase())}
                    placeholder="e.g., HDFC0001234"
                  />
                </div>
                <div>
                  <Label className="form-label">Account Number</Label>
                  <Input
                    value={formData.bank_details.account_number}
                    onChange={(e) => handleBankChange("account_number", e.target.value)}
                    placeholder="e.g., 50100123456789"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="form-label">Account Holder Name</Label>
                  <Input
                    value={formData.bank_details.account_holder_name}
                    onChange={(e) => handleBankChange("account_holder_name", e.target.value)}
                    placeholder="Company/Individual name"
                  />
                </div>
                <div>
                  <Label className="form-label">Cancel Cheque URL</Label>
                  <Input
                    value={formData.bank_details.cancel_cheque_url || ""}
                    onChange={(e) => handleBankChange("cancel_cheque_url", e.target.value)}
                    placeholder="https://drive.google.com/..."
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Team Members */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Team Members
                </CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={addTeamMember}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Member
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {formData.team_members.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>No team members added</p>
                  <p className="text-sm">Add team members like accountant, director, coordinator</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {formData.team_members.map((member, index) => (
                    <div key={member.id || index} className="p-4 bg-slate-50 rounded-lg">
                      <div className="flex items-start justify-between mb-3">
                        <span className="text-sm font-medium text-slate-500">Team Member #{index + 1}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeTeamMember(index)}
                          className="text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div>
                          <Label className="text-xs">Name</Label>
                          <Input
                            value={member.name}
                            onChange={(e) => updateTeamMember(index, "name", e.target.value)}
                            placeholder="Full name"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Phone</Label>
                          <Input
                            value={member.phone}
                            onChange={(e) => updateTeamMember(index, "phone", e.target.value)}
                            placeholder="+91 9876543210"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Email</Label>
                          <Input
                            type="email"
                            value={member.email}
                            onChange={(e) => updateTeamMember(index, "email", e.target.value)}
                            placeholder="email@example.com"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Role</Label>
                          <Select
                            value={member.role}
                            onValueChange={(v) => updateTeamMember(index, "role", v)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="director">Director</SelectItem>
                              <SelectItem value="accountant">Accountant</SelectItem>
                              <SelectItem value="coordinator">Coordinator</SelectItem>
                              <SelectItem value="sales">Sales</SelectItem>
                              <SelectItem value="support">Support</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-3">
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
        </form>
      </div>
    </div>
  );
};

export default VendorForm;
