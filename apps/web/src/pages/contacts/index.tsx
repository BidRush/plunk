import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Switch,
} from '@plunk/ui';
import type {Contact} from '@plunk/db';
import type {CursorPaginatedResponse} from '@plunk/types';
import {DashboardLayout} from '../../components/DashboardLayout';
import {KeyValueEditor} from '../../components/KeyValueEditor';
import {network} from '../../lib/network';
import {formatRelativeTime} from '../../lib/dateUtils';
import {
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Edit,
  FileUp,
  Mail,
  MailCheck,
  MailX,
  Plus,
  Search,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import {NextSeo} from 'next-seo';
import Link from 'next/link';
import {useEffect, useRef, useState} from 'react';
import {toast} from 'sonner';
import useSWR from 'swr';
import {ContactSchemas} from '@plunk/shared';
import {useActiveProject} from '../../lib/contexts/ActiveProjectProvider';
import dayjs from 'dayjs';

export default function ContactsPage() {
  const {activeProject} = useActiveProject();
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorHistory, setCursorHistory] = useState<(string | undefined)[]>([undefined]);
  const [currentPage, setCurrentPage] = useState(0);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [showBulkActionsDialog, setShowBulkActionsDialog] = useState(false);
  const [bulkOperation, setBulkOperation] = useState<'subscribe' | 'unsubscribe' | 'delete' | null>(null);
  const pageSize = 50;

  const {data, mutate, isLoading} = useSWR<CursorPaginatedResponse<Contact>>(
    activeProject ? `/contacts?limit=${pageSize}${cursor ? `&cursor=${cursor}` : ''}${search ? `&search=${search}` : ''}` : null,
    {revalidateOnFocus: false},
  );

    useEffect(() => {
    if (data) {
      setContacts(data.data);
      if (!cursor) {
        setTotalCount(data.total || data.data.length);
      }
    }
  }, [data, cursor]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setCursor(undefined);
    setCursorHistory([undefined]);
    setCurrentPage(0);
    setContacts([]);
  };

  const handleNextPage = () => {
    if (data?.cursor) {
      const newPage = currentPage + 1;
      setCursor(data.cursor);
      setCurrentPage(newPage);
      setSelectedContacts(new Set()); // Clear selection on page change

      // Store cursor in history if not already there
      if (cursorHistory.length <= newPage) {
        setCursorHistory(prev => [...prev, data.cursor]);
      }
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 0) {
      const newPage = currentPage - 1;
      const previousCursor = cursorHistory[newPage];
      setCursor(previousCursor);
      setCurrentPage(newPage);
      setSelectedContacts(new Set()); // Clear selection on page change
    }
  };

  const handleSelectAll = () => {
    if (selectedContacts.size === contacts.length && contacts.length > 0) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(contacts.map(c => c.id)));
    }
  };

  const handleSelectContact = (contactId: string) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId);
    } else {
      newSelected.add(contactId);
    }
    setSelectedContacts(newSelected);
  };

  const handleBulkAction = (operation: 'subscribe' | 'unsubscribe' | 'delete') => {
    setBulkOperation(operation);
    setShowBulkActionsDialog(true);
  };

  const clearSelection = () => {
    setSelectedContacts(new Set());
  };

  const promptDelete = (contactId: string) => {
    setContactToDelete(contactId);
    setShowDeleteDialog(true);
  };

  const handleDelete = async () => {
    if (!contactToDelete) return;

    try {
      await network.fetch('DELETE', `/contacts/${contactToDelete}`);
      toast.success('Contact deleted successfully');
      void mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete contact');
    } finally {
      setContactToDelete(null);
    }
  };

  return (
    <>
      <NextSeo title="Contacts" />
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900">Contacts</h1>
                <p className="text-neutral-500 mt-2 text-sm sm:text-base">
                  Manage your email subscribers and their data.{' '}
                  {totalCount > 0 ? `${totalCount.toLocaleString()} total contacts` : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowImportDialog(true)} className="flex-1 sm:flex-none">
                  <Upload className="h-4 w-4" />
                  <span className="hidden sm:inline">Import CSV</span>
                  <span className="sm:hidden">Import</span>
                </Button>
                <Button onClick={() => setShowCreateDialog(true)} className="flex-1 sm:flex-none">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Add Contact</span>
                  <span className="sm:hidden">Add</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Search & Filters */}
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                  <Input
                    type="text"
                    placeholder="Search by email..."
                    value={searchInput}
                    onChange={e => setSearchInput(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button type="submit">Search</Button>
                {search && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSearch('');
                      setSearchInput('');
                      setCursor(undefined);
                      setCursorHistory([undefined]);
                      setCurrentPage(0);
                      setContacts([]);
                    }}
                  >
                    Clear
                  </Button>
                )}
              </form>
            </CardContent>
          </Card>

          {/* Bulk Actions Toolbar */}
          {selectedContacts.size > 0 && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-neutral-900">
                      {selectedContacts.size} contact{selectedContacts.size !== 1 ? 's' : ''} selected
                    </span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleBulkAction('subscribe')}>
                        <MailCheck className="h-4 w-4 mr-1.5" />
                        Subscribe
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleBulkAction('unsubscribe')}>
                        <MailX className="h-4 w-4 mr-1.5" />
                        Unsubscribe
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleBulkAction('delete')}>
                        <Trash2 className="h-4 w-4 mr-1.5" />
                        Delete
                      </Button>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={clearSelection}>
                    Clear Selection
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Contacts Table */}
          <Card>
            <CardHeader>
              <CardTitle>All Contacts</CardTitle>
              <CardDescription>
                View and manage your contact list.
                {totalCount > 0 && ` ${totalCount.toLocaleString()} total contacts`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading && contacts.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <svg
                      className="h-8 w-8 animate-spin mx-auto text-neutral-900"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <p className="mt-2 text-sm text-neutral-500">Loading contacts...</p>
                  </div>
                </div>
              ) : contacts.length === 0 ? (
                <div className="text-center py-12">
                  <Mail className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-neutral-900 mb-2">No contacts found</h3>
                  <p className="text-neutral-500 mb-6">
                    {search ? 'Try adjusting your search terms' : 'Get started by creating your first contact'}
                  </p>
                  {!search && (
                    <Button onClick={() => setShowCreateDialog(true)}>
                      <Plus className="h-4 w-4" />
                      Add Contact
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  {/* Desktop Table View - Hidden on mobile */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-neutral-50 border-b border-neutral-200">
                        <tr>
                          <th className="px-6 py-3 text-left w-12">
                            <Checkbox
                              checked={selectedContacts.size === contacts.length && contacts.length > 0}
                              onCheckedChange={handleSelectAll}
                            />
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                            Email
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                            Created
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-neutral-200">
                        {contacts.map(contact => (
                          <tr key={contact.id} className="hover:bg-neutral-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Checkbox
                                checked={selectedContacts.has(contact.id)}
                                onCheckedChange={() => handleSelectContact(contact.id)}
                              />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                {contact.subscribed ? (
                                  <MailCheck className="h-4 w-4 text-green-600" />
                                ) : (
                                  <MailX className="h-4 w-4 text-red-600" />
                                )}
                                <span className="text-sm font-medium text-neutral-900">{contact.email}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  contact.subscribed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {contact.subscribed ? 'Subscribed' : 'Unsubscribed'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                              <div className="group relative inline-block cursor-help">
                                {formatRelativeTime(contact.createdAt)}
                                <div className="hidden group-hover:block absolute z-10 w-48 p-2 bg-neutral-900 text-white text-xs rounded shadow-lg bottom-full left-1/2 transform -translate-x-1/2 mb-1 whitespace-nowrap">
                                  {dayjs(contact.createdAt).format('DD MMMM YYYY, hh:mm')}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex items-center justify-end gap-2">
                                <Link href={`/contacts/${contact.id}`}>
                                  <Button variant="ghost" size="sm">
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </Link>
                                <Button variant="ghost" size="sm" onClick={() => promptDelete(contact.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card View - Only visible on mobile */}
                  <div className="md:hidden space-y-3">
                    {contacts.map(contact => (
                      <div
                        key={contact.id}
                        className="border border-neutral-200 rounded-lg p-4 bg-white hover:bg-neutral-50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {contact.subscribed ? (
                              <MailCheck className="h-4 w-4 text-green-600 flex-shrink-0" />
                            ) : (
                              <MailX className="h-4 w-4 text-red-600 flex-shrink-0" />
                            )}
                            <span className="text-sm font-medium text-neutral-900 truncate">{contact.email}</span>
                          </div>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                              contact.subscribed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {contact.subscribed ? 'Subscribed' : 'Unsubscribed'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="group relative inline-block cursor-help">
                            <span className="text-xs text-neutral-500">{formatRelativeTime(contact.createdAt)}</span>
                            <div className="hidden group-hover:block absolute z-10 w-48 p-2 bg-neutral-900 text-white text-xs rounded shadow-lg bottom-full left-0 mb-1 whitespace-nowrap">
                              {dayjs(contact.createdAt).format('Do MMMM YYYY, h:mm A')}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Link href={`/contacts/${contact.id}`}>
                              <Button variant="ghost" size="sm">
                                <Edit className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button variant="ghost" size="sm" onClick={() => promptDelete(contact.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination Controls */}
                  {(currentPage > 0 || data?.hasMore) && (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-6 pt-6 border-t border-neutral-200">
                      <div className="text-xs sm:text-sm text-neutral-600 text-center sm:text-left">
                        Showing <span className="font-medium text-neutral-900">{currentPage * pageSize + 1}</span> to{' '}
                        <span className="font-medium text-neutral-900">{currentPage * pageSize + contacts.length}</span>
                        {totalCount > 0 && (
                          <>
                            {' '}
                            of <span className="font-medium text-neutral-900">{totalCount.toLocaleString()}</span>
                          </>
                        )}
                      </div>
                      <div className="flex gap-2 justify-center sm:justify-end">
                        <Button
                          variant="outline"
                          onClick={handlePreviousPage}
                          disabled={currentPage === 0 || isLoading}
                          className="flex-1 sm:flex-none"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          <span className="hidden sm:inline">Previous</span>
                        </Button>
                        <Button
                          variant="outline"
                          onClick={handleNextPage}
                          disabled={!data?.hasMore || isLoading}
                          className="flex-1 sm:flex-none"
                        >
                          <span className="hidden sm:inline">Next</span>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Create Contact Dialog */}
        <CreateContactDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} onSuccess={() => mutate()} />

        {/* Import Contacts Dialog */}
        <ImportContactsDialog open={showImportDialog} onOpenChange={setShowImportDialog} onSuccess={() => mutate()} />

        {/* Bulk Actions Dialog */}
        <BulkActionsDialog
          open={showBulkActionsDialog}
          onOpenChange={setShowBulkActionsDialog}
          operation={bulkOperation}
          contactIds={Array.from(selectedContacts)}
          onSuccess={() => {
            mutate();
            clearSelection();
          }}
        />

        {/* Delete Confirmation Dialog */}
        <ConfirmDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          onConfirm={handleDelete}
          title="Delete Contact"
          description="Are you sure you want to delete this contact? This action cannot be undone."
          confirmText="Delete"
          variant="destructive"
        />
      </DashboardLayout>
    </>
  );
}

interface CreateContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

function CreateContactDialog({open, onOpenChange, onSuccess}: CreateContactDialogProps) {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(true);
  const [customData, setCustomData] = useState<Record<string, string | number | boolean> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await network.fetch<
        {
          _meta?: {isNew: boolean; isUpdate: boolean};
          email: string;
        },
        typeof ContactSchemas.create
      >('POST', '/contacts', {email, subscribed, data: customData});

      // Show appropriate message based on whether contact was new or updated
      if (response._meta?.isUpdate) {
        toast.success(`Contact ${response.email} already existed and was updated with new data`);
      } else {
        toast.success('Contact created successfully');
      }

      setEmail('');
      setSubscribed(true);
      setCustomData(null);
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save contact');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Contact</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="contact@example.com"
            />
          </div>

          <div className="flex items-start gap-3 p-4 bg-neutral-50 rounded-lg border border-neutral-200">
            <Switch id="subscribed" checked={subscribed} onCheckedChange={setSubscribed} />
            <div className="flex-1">
              <Label htmlFor="subscribed" className="font-medium cursor-pointer">
                Subscribed
              </Label>
              <p className="text-xs text-neutral-500 mt-1">
                When enabled, this contact will receive emails from your campaigns and workflows.
              </p>
            </div>
          </div>

          <div>
            <KeyValueEditor key={open ? 'create' : 'closed'} initialData={customData} onChange={setCustomData} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Contact'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface ImportContactsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface ImportResult {
  totalRows: number;
  successCount: number;
  createdCount: number;
  updatedCount: number;
  failureCount: number;
  errors: Array<{row: number; email: string; error: string}>;
}

function ImportContactsDialog({open, onOpenChange, onSuccess}: ImportContactsDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [, setJobId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'completed' | 'failed'>('idle');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [showCloseConfirmDialog, setShowCloseConfirmDialog] = useState(false);

  // Helper function to truncate long file names from the middle
  const truncateFileName = (fileName: string, maxLength: number = 30) => {
    if (fileName.length <= maxLength) return fileName;

    const extension = fileName.substring(fileName.lastIndexOf('.'));
    const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
    const charsToShow = maxLength - extension.length - 3; // 3 for "..."
    const frontChars = Math.ceil(charsToShow / 2);
    const backChars = Math.floor(charsToShow / 2);

    return `${nameWithoutExt.substring(0, frontChars)}...${nameWithoutExt.substring(nameWithoutExt.length - backChars)}${extension}`;
  };

  // Clean up polling on unmount or dialog close
  useEffect(() => {
    if (!open) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      // Reset state when dialog closes
      setTimeout(() => {
        setFile(null);
        setJobId(null);
        setProgress(0);
        setStatus('idle');
        setResult(null);
        setErrorMessage(null);
      }, 300);
    }
  }, [open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      if (!selectedFile.name.endsWith('.csv')) {
        toast.error('Please select a CSV file');
        return;
      }

      // Validate file size (5MB max)
      if (selectedFile.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }

      setFile(selectedFile);
      setStatus('idle');
    }
  };

  const pollJobStatus = async (jobId: string) => {
    try {
      const response = await network.fetch<{
        id: string;
        state: string;
        progress: number;
        result: ImportResult | null;
        failedReason?: string;
      }>('GET', `/contacts/import/${jobId}`);

      setProgress(response.progress || 0);

      if (response.state === 'completed') {
        setStatus('completed');
        setResult(response.result);
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }

        // Show success message
        if (response.result) {
          const {createdCount, updatedCount, failureCount} = response.result;
          const parts = [];
          if (createdCount > 0) parts.push(`${createdCount} created`);
          if (updatedCount > 0) parts.push(`${updatedCount} updated`);
          if (failureCount > 0) parts.push(`${failureCount} failed`);

          toast.success(`Import completed: ${parts.join(', ')}`);
        }

        onSuccess();
      } else if (response.state === 'failed') {
        setStatus('failed');
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        // Store and show the specific error message if available, otherwise show generic error
        const errorMsg = response.failedReason || 'Import failed. Please check your CSV file and try again.';
        setErrorMessage(errorMsg);
        toast.error(errorMsg);
      } else if (response.state === 'active') {
        setStatus('processing');
      }
    } catch (error) {
      console.error('Failed to poll job status:', error);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      setStatus('failed');
      toast.error('Failed to check import status');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a file to upload');
      return;
    }

    setIsUploading(true);
    setStatus('uploading');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const data = await network.upload<{jobId: string; message: string}>('POST', '/contacts/import', formData);

      setJobId(data.jobId);
      setStatus('processing');

      // Start polling for job status
      pollIntervalRef.current = setInterval(() => {
        void pollJobStatus(data.jobId);
      }, 1000); // Poll every second
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to upload file';
      setErrorMessage(errorMsg);
      toast.error(errorMsg);
      setStatus('failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (status === 'processing') {
      setShowCloseConfirmDialog(true);
      return;
    }
    onOpenChange(false);
  };

  const confirmClose = () => {
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Contacts from CSV</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">CSV Format Requirements</h4>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>First row must contain column headers</li>
                <li>
                  Required column: <code className="bg-blue-100 px-1 rounded">email</code>
                </li>
                <li>
                  Optional: <code className="bg-blue-100 px-1 rounded">subscribed</code> (true/false, 1/0, yes/no)
                </li>
                <li>Optional: Add any custom fields (e.g., firstName, lastName, plan)</li>
                <li>Maximum file size: 5MB</li>
              </ul>
            </div>

            {/* File Upload */}
            {status === 'idle' || status === 'failed' ? (
              <div>
                <Label htmlFor="csv-file">Select CSV File</Label>
                <div className="mt-2">
                  <input
                    ref={fileInputRef}
                    id="csv-file"
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => fileInputRef.current?.click()}
                    type="button"
                  >
                    <FileUp className="h-4 w-4 mr-2" />
                    {file ? truncateFileName(file.name) : 'Choose CSV File'}
                  </Button>
                </div>
              </div>
            ) : null}

            {/* Progress */}
            {(status === 'uploading' || status === 'processing') && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-600">
                    {status === 'uploading' ? 'Uploading file...' : 'Processing contacts...'}
                  </span>
                  <span className="text-neutral-900 font-medium">{progress}%</span>
                </div>
                <div className="w-full bg-neutral-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{width: `${progress}%`}}
                  />
                </div>
              </div>
            )}

            {/* Results */}
            {status === 'completed' && result && (
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-neutral-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-neutral-900">{result.totalRows}</div>
                    <div className="text-sm text-neutral-600">Total</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <div className="text-2xl font-bold text-green-900">{result.createdCount}</div>
                    </div>
                    <div className="text-sm text-green-700">Created</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-blue-600" />
                      <div className="text-2xl font-bold text-blue-900">{result.updatedCount}</div>
                    </div>
                    <div className="text-sm text-blue-700">Updated</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-5 w-5 text-red-600" />
                      <div className="text-2xl font-bold text-red-900">{result.failureCount}</div>
                    </div>
                    <div className="text-sm text-red-700">Failed</div>
                  </div>
                </div>

                {/* Error Details */}
                {result.errors && result.errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-h-48 overflow-y-auto">
                    <h4 className="font-medium text-red-900 mb-2">Import Errors</h4>
                    <div className="space-y-1 text-sm text-red-800">
                      {result.errors.slice(0, 10).map((error, idx) => (
                        <div key={idx} className="flex gap-2">
                          <span className="font-mono text-xs">Row {error.row}:</span>
                          <span>
                            {error.email || 'N/A'} - {error.error}
                          </span>
                        </div>
                      ))}
                      {result.errors.length > 10 && (
                        <div className="text-red-700 font-medium mt-2">
                          ...and {result.errors.length - 10} more errors
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {status === 'failed' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-red-900">
                  <XCircle className="h-5 w-5" />
                  <span className="font-medium">Import failed</span>
                </div>
                <p className="text-sm text-red-800 mt-1">
                  {errorMessage || 'Please check your CSV file and try again.'}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            {status === 'idle' || status === 'failed' ? (
              <>
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleUpload} disabled={!file || isUploading}>
                  {isUploading ? 'Uploading...' : 'Import Contacts'}
                </Button>
              </>
            ) : status === 'completed' ? (
              <Button type="button" onClick={handleClose}>
                Close
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={handleClose}>
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={showCloseConfirmDialog}
        onOpenChange={setShowCloseConfirmDialog}
        onConfirm={confirmClose}
        title="Close Import"
        description="Import is still in progress. Are you sure you want to close?"
        confirmText="Close Anyway"
        variant="destructive"
      />
    </>
  );
}

interface BulkActionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operation: 'subscribe' | 'unsubscribe' | 'delete' | null;
  contactIds: string[];
  onSuccess: () => void;
}

interface BulkActionResult {
  operation: string;
  totalRequested: number;
  successCount: number;
  failureCount: number;
  errors: Array<{contactId: string; email: string; error: string}>;
}

function BulkActionsDialog({open, onOpenChange, operation, contactIds, onSuccess}: BulkActionsDialogProps) {
  const [, setJobId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'processing' | 'completed' | 'failed'>('idle');
  const [result, setResult] = useState<BulkActionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [showCloseConfirmDialog, setShowCloseConfirmDialog] = useState(false);

  // Clean up polling on unmount or dialog close
  useEffect(() => {
    if (!open) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      setTimeout(() => {
        setJobId(null);
        setProgress(0);
        setStatus('idle');
        setResult(null);
        setErrorMessage(null);
      }, 300);
    }
  }, [open]);

  const pollJobStatus = async (jobId: string) => {
    try {
      const response = await network.fetch<{
        id: string;
        state: string;
        progress: number;
        result: BulkActionResult | null;
        failedReason?: string;
      }>('GET', `/contacts/bulk/${jobId}`);

      setProgress(response.progress || 0);

      if (response.state === 'completed') {
        setStatus('completed');
        setResult(response.result);
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }

        if (response.result) {
          const {successCount, failureCount} = response.result;
          toast.success(`Completed: ${successCount} succeeded${failureCount > 0 ? `, ${failureCount} failed` : ''}`);
        }

        onSuccess();
      } else if (response.state === 'failed') {
        setStatus('failed');
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        const errorMsg = response.failedReason || 'Operation failed';
        setErrorMessage(errorMsg);
        toast.error(errorMsg);
      } else if (response.state === 'active') {
        setStatus('processing');
      }
    } catch (error) {
      console.error('Failed to poll job status:', error);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      setStatus('failed');
      toast.error('Failed to check operation status');
    }
  };

  const handleConfirm = async () => {
    if (!operation) return;

    setIsProcessing(true);
    setStatus('processing');

    try {
      const endpoint = `/contacts/bulk-${operation}`;
      const data = await network.fetch<{jobId: string; message: string}, typeof ContactSchemas.bulkAction>(
        'POST',
        endpoint,
        {contactIds},
      );

      setJobId(data.jobId);

      // Start polling for job status
      pollIntervalRef.current = setInterval(() => {
        void pollJobStatus(data.jobId);
      }, 1000);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to start operation';
      setErrorMessage(errorMsg);
      toast.error(errorMsg);
      setStatus('failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (status === 'processing') {
      setShowCloseConfirmDialog(true);
      return;
    }
    onOpenChange(false);
  };

  const confirmClose = () => {
    onOpenChange(false);
  };

  const getOperationLabel = () => {
    switch (operation) {
      case 'subscribe':
        return 'Subscribe';
      case 'unsubscribe':
        return 'Unsubscribe';
      case 'delete':
        return 'Delete';
      default:
        return 'Process';
    }
  };

  const getOperationColor = () => {
    switch (operation) {
      case 'subscribe':
        return 'green';
      case 'unsubscribe':
        return 'yellow';
      case 'delete':
        return 'red';
      default:
        return 'blue';
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{getOperationLabel()} Contacts</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {status === 'idle' && (
              <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
                <p className="text-sm text-neutral-900">
                  Are you sure you want to {operation} {contactIds.length} contact
                  {contactIds.length !== 1 ? 's' : ''}?
                </p>
                {operation === 'delete' && (
                  <p className="text-sm text-red-600 mt-2 font-medium">This action cannot be undone.</p>
                )}
              </div>
            )}

            {status === 'processing' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-600">Processing contacts...</span>
                  <span className="text-neutral-900 font-medium">{progress}%</span>
                </div>
                <div className="w-full bg-neutral-200 rounded-full h-2">
                  <div
                    className={`bg-${getOperationColor()}-600 h-2 rounded-full transition-all duration-300`}
                    style={{width: `${progress}%`}}
                  />
                </div>
              </div>
            )}

            {status === 'completed' && result && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <div className="text-2xl font-bold text-green-900">{result.successCount}</div>
                    </div>
                    <div className="text-sm text-green-700">Succeeded</div>
                  </div>
                  {result.failureCount > 0 && (
                    <div className="bg-red-50 rounded-lg p-4">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-5 w-5 text-red-600" />
                        <div className="text-2xl font-bold text-red-900">{result.failureCount}</div>
                      </div>
                      <div className="text-sm text-red-700">Failed</div>
                    </div>
                  )}
                </div>

                {result.errors && result.errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-h-48 overflow-y-auto">
                    <h4 className="font-medium text-red-900 mb-2">Errors</h4>
                    <div className="space-y-1 text-sm text-red-800">
                      {result.errors.slice(0, 10).map((error, idx) => (
                        <div key={idx}>{error.error}</div>
                      ))}
                      {result.errors.length > 10 && (
                        <div className="text-red-700 font-medium mt-2">
                          ...and {result.errors.length - 10} more errors
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {status === 'failed' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-red-900">
                  <XCircle className="h-5 w-5" />
                  <span className="font-medium">Operation failed</span>
                </div>
                <p className="text-sm text-red-800 mt-1">{errorMessage || 'Please try again.'}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            {status === 'idle' ? (
              <>
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirm}
                  disabled={isProcessing}
                  variant={operation === 'delete' ? 'destructive' : 'default'}
                >
                  {isProcessing ? 'Starting...' : getOperationLabel()}
                </Button>
              </>
            ) : status === 'completed' ? (
              <Button type="button" onClick={handleClose}>
                Close
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={handleClose}>
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={showCloseConfirmDialog}
        onOpenChange={setShowCloseConfirmDialog}
        onConfirm={confirmClose}
        title="Close Operation"
        description="Operation is still in progress. Are you sure you want to close?"
        confirmText="Close Anyway"
        variant="destructive"
      />
    </>
  );
}
