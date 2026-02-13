import { useState, useEffect } from "react";
import { apiClient } from "../../App";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { 
  Key, 
  Plus, 
  Copy, 
  Trash2, 
  Check, 
  X, 
  Loader2, 
  AlertTriangle,
  Eye,
  EyeOff,
  Shield
} from "lucide-react";
import { toast } from "sonner";

const APIKeysPage = () => {
  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newKeyDialogOpen, setNewKeyDialogOpen] = useState(false);
  const [newKey, setNewKey] = useState(null);
  const [creating, setCreating] = useState(false);
  const [showKey, setShowKey] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    description: ""
  });

  useEffect(() => {
    document.title = "OLL - API Keys";
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    try {
      const response = await apiClient.get("/api-keys");
      setApiKeys(response.data);
    } catch (error) {
      toast.error("Failed to fetch API keys");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async () => {
    if (!formData.name.trim()) {
      toast.error("Please enter a name for the API key");
      return;
    }

    setCreating(true);
    try {
      const response = await apiClient.post("/api-keys", formData);
      setNewKey(response.data);
      setCreateDialogOpen(false);
      setNewKeyDialogOpen(true);
      setFormData({ name: "", description: "" });
      fetchApiKeys();
      toast.success("API key created successfully");
    } catch (error) {
      toast.error("Failed to create API key");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleKey = async (keyId, currentStatus) => {
    try {
      await apiClient.patch(`/api-keys/${keyId}/toggle`);
      fetchApiKeys();
      toast.success(`API key ${currentStatus ? "disabled" : "enabled"}`);
    } catch (error) {
      toast.error("Failed to update API key");
    }
  };

  const handleDeleteKey = async (keyId) => {
    if (!window.confirm("Are you sure you want to delete this API key? This action cannot be undone.")) {
      return;
    }

    try {
      await apiClient.delete(`/api-keys/${keyId}`);
      fetchApiKeys();
      toast.success("API key deleted");
    } catch (error) {
      toast.error("Failed to delete API key");
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">API Keys</h1>
          <p className="text-slate-500 mt-1">
            Manage API keys for external applications to access ProcureWay data
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Generate New Key
        </Button>
      </div>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">External API Access</p>
              <p>API keys allow external applications (like OLL CRM) to securely access PO data. 
                 Each key should be used for a single integration. Keys can be disabled or deleted at any time.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Keys Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            Active API Keys
          </CardTitle>
          <CardDescription>
            {apiKeys.length} key{apiKeys.length !== 1 ? "s" : ""} configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Key className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No API keys generated yet</p>
              <p className="text-sm mt-1">Create your first API key to enable external access</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{key.name}</p>
                        {key.description && (
                          <p className="text-xs text-slate-500">{key.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-slate-100 px-2 py-1 rounded">
                        {key.key_prefix}
                      </code>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        key.is_active 
                          ? "bg-green-100 text-green-700" 
                          : "bg-red-100 text-red-700"
                      }`}>
                        {key.is_active ? (
                          <><Check className="w-3 h-3" /> Active</>
                        ) : (
                          <><X className="w-3 h-3" /> Disabled</>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {formatDate(key.created_at)}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {key.last_used_at ? formatDate(key.last_used_at) : "Never"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleKey(key.id, key.is_active)}
                          title={key.is_active ? "Disable key" : "Enable key"}
                        >
                          {key.is_active ? (
                            <EyeOff className="w-4 h-4 text-amber-600" />
                          ) : (
                            <Eye className="w-4 h-4 text-green-600" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteKey(key.id)}
                          className="text-red-600 hover:bg-red-50"
                          title="Delete key"
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

      {/* API Usage Documentation */}
      <Card>
        <CardHeader>
          <CardTitle>API Usage</CardTitle>
          <CardDescription>How to use API keys with external applications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-slate-900 text-slate-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
            <p className="text-slate-400"># Example: Get PO details</p>
            <p>curl "https://your-domain.com/api/external/po/PO-001" \</p>
            <p className="pl-4">-H "X-API-Key: your_api_key_here"</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="font-medium text-slate-700 mb-1">Available Endpoints:</p>
              <ul className="text-slate-600 space-y-1">
                <li>• <code className="text-xs bg-white px-1 rounded">GET /api/external/po</code> - List POs</li>
                <li>• <code className="text-xs bg-white px-1 rounded">GET /api/external/po/{'{po_number}'}</code> - PO details</li>
                <li>• <code className="text-xs bg-white px-1 rounded">GET /api/external/po/{'{po_number}'}/pdf</code> - Download PDF</li>
                <li>• <code className="text-xs bg-white px-1 rounded">GET /api/external/po/{'{po_number}'}/line-items</code> - Line items</li>
              </ul>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="font-medium text-slate-700 mb-1">Query Parameters:</p>
              <ul className="text-slate-600 space-y-1">
                <li>• <code className="text-xs bg-white px-1 rounded">status</code> - Filter by status</li>
                <li>• <code className="text-xs bg-white px-1 rounded">vendor_id</code> - Filter by vendor</li>
                <li>• <code className="text-xs bg-white px-1 rounded">school_name</code> - Filter by school</li>
                <li>• <code className="text-xs bg-white px-1 rounded">limit</code>, <code className="text-xs bg-white px-1 rounded">offset</code> - Pagination</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create Key Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Generate New API Key
            </DialogTitle>
            <DialogDescription>
              Create a new API key for external application access
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="key-name">Key Name *</Label>
              <Input
                id="key-name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., OLL CRM Integration"
              />
            </div>
            <div>
              <Label htmlFor="key-desc">Description (optional)</Label>
              <Textarea
                id="key-desc"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="What is this key used for?"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateKey} disabled={creating}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Key className="w-4 h-4 mr-2" />}
              Generate Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Key Display Dialog */}
      <Dialog open={newKeyDialogOpen} onOpenChange={setNewKeyDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <Check className="w-5 h-5" />
              API Key Generated!
            </DialogTitle>
            <DialogDescription>
              Copy this key now. For security reasons, it won't be shown again.
            </DialogDescription>
          </DialogHeader>
          
          {newKey && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <p className="text-sm text-amber-800">
                    <strong>Important:</strong> Save this key securely. You won't be able to see it again after closing this dialog.
                  </p>
                </div>
              </div>

              <div>
                <Label className="text-slate-600">Key Name</Label>
                <p className="font-medium">{newKey.name}</p>
              </div>

              <div>
                <Label className="text-slate-600">Your API Key</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 p-3 bg-slate-900 text-green-400 rounded-lg font-mono text-sm break-all">
                    {showKey ? newKey.key : "•".repeat(50)}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowKey(!showKey)}
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(newKey.key)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button 
              onClick={() => {
                setNewKeyDialogOpen(false);
                setNewKey(null);
                setShowKey(false);
              }}
              className="bg-green-600 hover:bg-green-700"
            >
              I've Saved the Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default APIKeysPage;
