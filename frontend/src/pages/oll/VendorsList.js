import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../App";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
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
import { Plus, Search, Edit, Trash2, Building2 } from "lucide-react";
import { toast } from "sonner";

const VendorsList = () => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      const response = await apiClient.get("/vendors");
      setVendors(response.data);
    } catch (error) {
      toast.error("Failed to fetch vendors");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this vendor?")) return;
    
    try {
      await apiClient.delete(`/vendors/${id}`);
      toast.success("Vendor deleted successfully");
      fetchVendors();
    } catch (error) {
      toast.error("Failed to delete vendor");
    }
  };

  const filteredVendors = vendors.filter((vendor) => {
    const matchesSearch = 
      vendor.name.toLowerCase().includes(search.toLowerCase()) ||
      vendor.email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = 
      statusFilter === "all" || 
      (statusFilter === "active" && vendor.is_active) ||
      (statusFilter === "inactive" && !vendor.is_active);
    return matchesSearch && matchesStatus;
  });

  return (
    <div data-testid="vendors-list-page">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Vendors</h1>
            <p className="page-subtitle">Manage your vendor database</p>
          </div>
          <Link to="/oll/vendors/new">
            <Button className="bg-[#1e3a8a] hover:bg-[#1e40af]" data-testid="add-vendor-btn">
              <Plus className="w-4 h-4 mr-2" />
              Add Vendor
            </Button>
          </Link>
        </div>
      </div>

      <div className="page-container">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search vendors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              data-testid="search-input"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]" data-testid="status-filter">
              <SelectValue placeholder="Filter by status" />
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
          ) : filteredVendors.length === 0 ? (
            <div className="empty-state py-12">
              <Building2 className="empty-state-icon" />
              <p className="empty-state-title">No vendors found</p>
              <p className="empty-state-text">Get started by adding your first vendor</p>
              <Link to="/oll/vendors/new" className="mt-4">
                <Button>Add Vendor</Button>
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>GST Number</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVendors.map((vendor) => (
                  <TableRow key={vendor.id} data-testid={`vendor-row-${vendor.id}`}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-slate-900">{vendor.name}</p>
                        {vendor.contact_person && (
                          <p className="text-xs text-slate-500">{vendor.contact_person}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{vendor.email}</TableCell>
                    <TableCell>{vendor.phone}</TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">{vendor.gst_number || "-"}</span>
                    </TableCell>
                    <TableCell>
                      <span className={`badge ${vendor.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {vendor.is_active ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link to={`/oll/vendors/${vendor.id}/edit`}>
                          <Button variant="ghost" size="sm" data-testid={`edit-vendor-${vendor.id}`}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(vendor.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          data-testid={`delete-vendor-${vendor.id}`}
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
    </div>
  );
};

export default VendorsList;
