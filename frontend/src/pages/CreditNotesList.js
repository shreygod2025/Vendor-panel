import { useState, useEffect } from "react";
import { apiClient, useAuth } from "../App";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { FileCheck } from "lucide-react";
import { toast } from "sonner";

const CreditNotesList = () => {
  const { user } = useAuth();
  const [creditNotes, setCreditNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCreditNotes();
  }, []);

  const fetchCreditNotes = async () => {
    try {
      const response = await apiClient.get("/credit-notes");
      setCreditNotes(response.data);
    } catch (error) {
      toast.error("Failed to fetch credit notes");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div data-testid="credit-notes-list-page">
      <div className="page-header">
        <h1 className="page-title">Credit Notes</h1>
        <p className="page-subtitle">View issued credit notes</p>
      </div>

      <div className="page-container">
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : creditNotes.length === 0 ? (
            <div className="empty-state py-12">
              <FileCheck className="empty-state-icon" />
              <p className="empty-state-title">No credit notes found</p>
              <p className="empty-state-text">Credit notes will appear here when issued</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Credit Note #</TableHead>
                  <TableHead>Return ID</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total Value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {creditNotes.map((cn) => (
                  <TableRow key={cn.id}>
                    <TableCell className="font-mono font-medium">{cn.credit_note_number}</TableCell>
                    <TableCell className="font-mono text-sm">{cn.return_id.slice(0, 8)}...</TableCell>
                    <TableCell>{cn.items?.length || 0} items</TableCell>
                    <TableCell className="font-mono font-medium text-emerald-600">
                      {formatCurrency(cn.total_value)}
                    </TableCell>
                    <TableCell>
                      <span className="badge bg-emerald-100 text-emerald-700">{cn.status}</span>
                    </TableCell>
                    <TableCell className="text-slate-500">{formatDate(cn.created_at)}</TableCell>
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

export default CreditNotesList;
