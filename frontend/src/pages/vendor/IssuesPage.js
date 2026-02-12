import { useState, useEffect } from "react";
import { apiClient, useAuth } from "../../App";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Input } from "../../components/ui/input";
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
import { AlertTriangle, Loader2, Eye, MessageSquare, Paperclip, Send, FileText, X, CheckCircle, ChevronRight } from "lucide-react";
import { toast } from "sonner";

const VendorIssuesPage = () => {
  const { user } = useAuth();
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [replyMessage, setReplyMessage] = useState("");
  const [replyAttachment, setReplyAttachment] = useState(null);
  const [sendingReply, setSendingReply] = useState(false);

  useEffect(() => {
    fetchIssues();
  }, []);

  const fetchIssues = async () => {
    try {
      const response = await apiClient.get("/issues");
      setIssues(response.data);
    } catch (error) {
      toast.error("Failed to fetch issues");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      open: "bg-red-100 text-red-700",
      in_progress: "bg-blue-100 text-blue-700",
      resolved: "bg-emerald-100 text-emerald-700"
    };
    return colors[status] || "bg-slate-100 text-slate-600";
  };

  const getPriorityColor = (priority) => {
    const colors = {
      critical: "bg-red-100 text-red-700",
      high: "bg-orange-100 text-orange-700",
      medium: "bg-yellow-100 text-yellow-700",
      low: "bg-slate-100 text-slate-600"
    };
    return colors[priority] || "bg-slate-100 text-slate-600";
  };

  const viewIssue = async (issue) => {
    try {
      const response = await apiClient.get(`/issues/${issue.id}`);
      setSelectedIssue(response.data);
      setShowViewDialog(true);
      setReplyMessage("");
      setReplyAttachment(null);
    } catch (error) {
      toast.error("Failed to load issue details");
    }
  };

  const handleReplyFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
      if (!validTypes.includes(file.type)) {
        toast.error("Only PNG, JPEG, and PDF files are allowed");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size must be less than 5MB");
        return;
      }
      setReplyAttachment(file);
    }
  };

  const handleSendReply = async () => {
    if (!replyMessage.trim() && !replyAttachment) {
      toast.error("Please enter a message or attach a file");
      return;
    }
    
    setSendingReply(true);
    try {
      let attachmentUrl = null;
      if (replyAttachment) {
        const reader = new FileReader();
        attachmentUrl = await new Promise((resolve) => {
          reader.onload = (e) => resolve(e.target.result);
          reader.readAsDataURL(replyAttachment);
        });
      }
      
      const response = await apiClient.post(`/issues/${selectedIssue.id}/reply`, {
        message: replyMessage.trim(),
        attachment_url: attachmentUrl
      });
      
      setSelectedIssue(response.data);
      setReplyMessage("");
      setReplyAttachment(null);
      toast.success("Reply sent successfully");
      fetchIssues();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to send reply");
    } finally {
      setSendingReply(false);
    }
  };

  const filteredIssues = issues.filter(issue => 
    statusFilter === "all" || issue.status === statusFilter
  );

  return (
    <div data-testid="vendor-issues-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Issues</h1>
          <p className="page-subtitle">View and respond to issues raised by OLL</p>
        </div>
      </div>

      <div className="page-container">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className={statusFilter === "open" ? "ring-2 ring-blue-500" : ""} onClick={() => setStatusFilter("open")}>
            <CardContent className="p-4 cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{issues.filter(i => i.status === 'open').length}</p>
                  <p className="text-sm text-slate-500">Open Issues</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={statusFilter === "in_progress" ? "ring-2 ring-blue-500" : ""} onClick={() => setStatusFilter("in_progress")}>
            <CardContent className="p-4 cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{issues.filter(i => i.status === 'in_progress').length}</p>
                  <p className="text-sm text-slate-500">In Progress</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={statusFilter === "all" ? "ring-2 ring-blue-500" : ""} onClick={() => setStatusFilter("all")}>
            <CardContent className="p-4 cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{issues.filter(i => i.status === 'resolved').length}</p>
                  <p className="text-sm text-slate-500">Resolved</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Issues Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : filteredIssues.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-lg font-medium">No issues found</p>
                <p className="text-sm">No issues have been raised for your orders</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Issue #</TableHead>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIssues.map((issue) => (
                    <TableRow key={issue.id}>
                      <TableCell className="font-mono font-medium">{issue.issue_number}</TableCell>
                      <TableCell className="font-mono text-sm">{issue.po_number}</TableCell>
                      <TableCell className="capitalize">{issue.issue_type?.replace('_', ' ')}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{issue.description}</TableCell>
                      <TableCell>
                        <span className={`badge ${getPriorityColor(issue.priority)}`}>
                          {issue.priority}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`badge ${getStatusColor(issue.status)}`}>
                          {issue.status?.replace('_', ' ')}
                        </span>
                      </TableCell>
                      <TableCell className="text-slate-500">{formatDate(issue.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            onClick={() => viewIssue(issue)}
                            className={issue.status === "open" ? "bg-blue-600 hover:bg-blue-700" : "bg-slate-600 hover:bg-slate-700"}
                            data-testid={`reply-issue-${issue.id}`}
                          >
                            <MessageSquare className="w-4 h-4 mr-1" />
                            {issue.status === "open" ? "Reply" : "View"}
                          </Button>
                          {issue.replies?.length > 0 && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                              {issue.replies.length}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* View Issue Dialog with Replies - Reply at Top */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="pb-0">
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Issue {selectedIssue?.issue_number}
              <span className={`badge ml-2 ${selectedIssue ? getStatusColor(selectedIssue.status) : ''}`}>
                {selectedIssue?.status?.replace('_', ' ')}
              </span>
            </DialogTitle>
          </DialogHeader>
          
          {selectedIssue && (
            <>
              {/* Sticky Reply Input at Top for Open Issues */}
              {selectedIssue.status !== "resolved" && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 -mx-2 mt-2">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <Textarea
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                        placeholder="Type your response here..."
                        rows={2}
                        className="bg-white"
                        data-testid="reply-textarea"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button 
                        onClick={handleSendReply}
                        disabled={sendingReply || (!replyMessage.trim() && !replyAttachment)}
                        className="bg-blue-600 hover:bg-blue-700"
                        data-testid="send-reply-btn"
                      >
                        {sendingReply ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Send className="w-4 h-4 mr-1" />
                            Send
                          </>
                        )}
                      </Button>
                      <label className="cursor-pointer">
                        <Input
                          type="file"
                          accept=".png,.jpg,.jpeg,.pdf"
                          onChange={handleReplyFileChange}
                          className="hidden"
                        />
                        <div className="flex items-center justify-center gap-1 text-xs text-slate-600 hover:text-blue-600 px-2 py-1.5 rounded border bg-white hover:bg-blue-50">
                          <Paperclip className="w-3 h-3" />
                          Attach
                        </div>
                      </label>
                    </div>
                  </div>
                  {replyAttachment && (
                    <div className="flex items-center gap-1 text-xs bg-white text-blue-700 px-2 py-1 rounded mt-2 w-fit">
                      <Paperclip className="w-3 h-3" />
                      {replyAttachment.name.slice(0, 20)}...
                      <button onClick={() => setReplyAttachment(null)} className="ml-1">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="flex-1 overflow-y-auto space-y-4 mt-4">
                {/* Conversation Section - Primary Focus */}
                <div>
                  <h4 className="font-medium text-slate-700 mb-3 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Conversation ({selectedIssue.replies?.length || 0})
                  </h4>
                  
                  {selectedIssue.replies?.length > 0 ? (
                    <div className="space-y-3">
                      {selectedIssue.replies.map((reply, index) => (
                        <div 
                          key={reply.id || index}
                          className={`p-3 rounded-lg ${
                            reply.created_by_role === 'vendor' 
                              ? 'bg-blue-50 border border-blue-200 ml-8' 
                              : 'bg-slate-50 border border-slate-200 mr-8'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-xs font-medium ${
                              reply.created_by_role === 'vendor' ? 'text-blue-700' : 'text-slate-700'
                            }`}>
                              {reply.created_by_name || 'Unknown'} 
                              <span className="font-normal">
                                ({reply.created_by_role === 'vendor' ? 'You' : 'OLL'})
                              </span>
                            </span>
                            <span className="text-xs text-slate-400">{formatDate(reply.created_at)}</span>
                          </div>
                          <p className="text-sm">{reply.message}</p>
                          {reply.attachment_url && (
                            <div className="mt-2 pt-2 border-t">
                              {reply.attachment_url.startsWith('data:image') ? (
                                <img 
                                  src={reply.attachment_url} 
                                  alt="Attachment" 
                                  className="max-w-full max-h-32 rounded border"
                                />
                              ) : (
                                <a 
                                  href={reply.attachment_url} 
                                  download="attachment.pdf"
                                  className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                                >
                                  <Paperclip className="w-3 h-3" />
                                  View Attachment
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 bg-slate-50 rounded-lg">
                      <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="text-sm text-slate-500">No replies yet</p>
                      <p className="text-xs text-slate-400">Use the form above to respond</p>
                    </div>
                  )}
                </div>

                {/* Issue Details - Collapsible Section */}
                <details className="group">
                  <summary className="cursor-pointer text-sm font-medium text-slate-600 hover:text-slate-800 flex items-center gap-2 py-2">
                    <ChevronRight className="w-4 h-4 group-open:rotate-90 transition-transform" />
                    Issue Details
                  </summary>
                  <div className="pl-6 space-y-3 mt-2">
                    {/* Issue Info */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-2 bg-slate-50 rounded">
                        <p className="text-xs text-slate-500">PO Number</p>
                        <p className="font-mono text-sm">{selectedIssue.po_number}</p>
                      </div>
                      <div className="p-2 bg-slate-50 rounded">
                        <p className="text-xs text-slate-500">Type</p>
                        <p className="text-sm capitalize">{selectedIssue.issue_type?.replace('_', ' ')}</p>
                      </div>
                      <div className="p-2 bg-slate-50 rounded">
                        <p className="text-xs text-slate-500">Priority</p>
                        <span className={`badge text-xs ${getPriorityColor(selectedIssue.priority)}`}>
                          {selectedIssue.priority}
                        </span>
                      </div>
                      <div className="p-2 bg-slate-50 rounded">
                        <p className="text-xs text-slate-500">Reported</p>
                        <p className="text-sm">{formatDate(selectedIssue.created_at)}</p>
                      </div>
                    </div>
                    
                    {/* Description */}
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-xs text-amber-600 mb-1">Description</p>
                      <p className="text-sm">{selectedIssue.description}</p>
                      {selectedIssue.attachment_url && (
                        <div className="mt-2 pt-2 border-t border-amber-200">
                          {selectedIssue.attachment_url.startsWith('data:image') ? (
                            <img 
                              src={selectedIssue.attachment_url} 
                              alt="Attachment" 
                              className="max-w-full max-h-32 rounded border"
                            />
                          ) : (
                            <a 
                              href={selectedIssue.attachment_url} 
                              download="attachment.pdf"
                              className="inline-flex items-center gap-1 text-sm text-amber-700 hover:underline"
                            >
                              <FileText className="w-3 h-3" />
                              Download Attachment
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Resolution */}
                    {selectedIssue.resolution && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <p className="text-xs text-emerald-600 mb-1">Resolution</p>
                        <p className="text-sm">{selectedIssue.resolution}</p>
                      </div>
                    )}
                  </div>
                </details>
              </div>
            </>
          )}
          
          <DialogFooter className="border-t pt-3 mt-2">
            <Button variant="outline" onClick={() => setShowViewDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VendorIssuesPage;
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VendorIssuesPage;
