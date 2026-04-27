import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  Input,
} from '@plunk/ui';
import type {Template} from '@plunk/db';
import type {PaginatedResponse} from '@plunk/types';
import {DashboardLayout} from '../../components/DashboardLayout';
import {network} from '../../lib/network';
import {formatRelativeTime} from '../../lib/dateUtils';
import {Calendar, Copy, Edit, FileText, Plus, Search, Trash2} from 'lucide-react';
import {NextSeo} from 'next-seo';
import Link from 'next/link';
import {useState} from 'react';
import {toast} from 'sonner';
import useSWR from 'swr';
import dayjs from 'dayjs';
import {useActiveProject} from '../../lib/contexts/ActiveProjectProvider';

export default function TemplatesPage() {
  const {activeProject} = useActiveProject();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'TRANSACTIONAL' | 'MARKETING' | 'HEADLESS'>('ALL');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);

  const {data, mutate, isLoading} = useSWR<PaginatedResponse<Template>>(
    activeProject ? `/templates?page=${page}&pageSize=20${search ? `&search=${search}` : ''}${typeFilter !== 'ALL' ? `&type=${typeFilter}` : ''}` : null,
    {revalidateOnFocus: false},
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const handleDelete = async () => {
    if (!templateToDelete) return;

    try {
      await network.fetch('DELETE', `/templates/${templateToDelete}`);
      toast.success('Template deleted successfully');
      void mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete template');
    } finally {
      setTemplateToDelete(null);
    }
  };

  const handleDuplicate = async (templateId: string) => {
    try {
      await network.fetch('POST', `/templates/${templateId}/duplicate`);
      toast.success('Template duplicated successfully');
      void mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to duplicate template');
    }
  };

  return (
    <>
      <NextSeo title="Templates" />
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900">Email Templates</h1>
              <p className="text-neutral-500 mt-2 text-sm sm:text-base">
                Create and manage reusable email templates for your campaigns and workflows.{' '}
                {data?.total ? `${data.total} total templates` : ''}
              </p>
            </div>
            <Link href="/templates/create" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Create Template</span>
                <span className="sm:hidden">Create</span>
              </Button>
            </Link>
          </div>

          {/* Search & Filters */}
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleSearch} className="space-y-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                    <Input
                      type="text"
                      placeholder="Search templates..."
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
                        setPage(1);
                      }}
                    >
                      Clear
                    </Button>
                  )}
                </div>

                {/* Type Filter */}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={() => setTypeFilter('ALL')}
                    variant={typeFilter === 'ALL' ? 'default' : 'secondary'}
                    size="sm"
                  >
                    All Templates
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setTypeFilter('MARKETING')}
                    variant={typeFilter === 'MARKETING' ? 'default' : 'secondary'}
                    size="sm"
                  >
                    Marketing
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setTypeFilter('TRANSACTIONAL')}
                    variant={typeFilter === 'TRANSACTIONAL' ? 'default' : 'secondary'}
                    size="sm"
                  >
                    Transactional
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setTypeFilter('HEADLESS')}
                    variant={typeFilter === 'HEADLESS' ? 'default' : 'secondary'}
                    size="sm"
                  >
                    Headless
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Templates Grid */}
          <div className="grid gap-4">
            {isLoading ? (
              <Card>
                <CardContent className="pt-6">
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
                      <p className="mt-2 text-sm text-neutral-500">Loading templates...</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : data?.data.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-neutral-900 mb-2">No templates found</h3>
                    <p className="text-neutral-500 mb-6">
                      {search ? 'Try adjusting your search terms' : 'Get started by creating your first template'}
                    </p>
                    {!search && (
                      <Link href="/templates/create">
                        <Button>
                          <Plus className="h-4 w-4" />
                          Create Template
                        </Button>
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {data?.data.map(template => (
                  <Card key={template.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <CardTitle>{template.name}</CardTitle>
                            <Badge
                              className={'capitalize'}
                              variant={template.type === 'MARKETING' ? 'info' : template.type === 'HEADLESS' ? 'warning' : 'success'}
                            >
                              {template.type.toLowerCase()}
                            </Badge>
                          </div>
                          {template.description && (
                            <CardDescription className="mt-2">{template.description}</CardDescription>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Link href={`/templates/${template.id}`}>
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button variant="ghost" size="sm" onClick={() => handleDuplicate(template.id)}>
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setTemplateToDelete(template.id);
                              setShowDeleteDialog(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs text-neutral-500 mb-1">Subject</p>
                          <p className="text-sm font-medium text-neutral-900">{template.subject}</p>
                        </div>
                        <div>
                          <p className="text-xs text-neutral-500 mb-1">From</p>
                          <p className="text-sm text-neutral-700">{template.from}</p>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-neutral-500 pt-3 border-t border-neutral-100">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3 w-3" />
                            <div className="group relative inline-block cursor-help">
                              <span>Created {formatRelativeTime(template.createdAt)}</span>
                              <div className="hidden group-hover:block absolute z-10 w-48 p-2 bg-neutral-900 text-white text-xs rounded shadow-lg bottom-full left-0 mb-1 whitespace-nowrap">
                                {dayjs(template.createdAt).format('DD MMMM YYYY, hh:mm')}
                              </div>
                            </div>
                          </div>
                          <div className="group relative inline-block cursor-help">
                            <span>• Updated {formatRelativeTime(template.updatedAt)}</span>
                            <div className="hidden group-hover:block absolute z-10 w-48 p-2 bg-neutral-900 text-white text-xs rounded shadow-lg bottom-full left-0 mb-1 whitespace-nowrap">
                              {dayjs(template.updatedAt).format('DD MMMM YYYY, hh:mm')}
                            </div>
                          </div>
                          {template.replyTo && (
                            <div>
                              Reply to: <span className="text-neutral-700">{template.replyTo}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {/* Pagination */}
                {data && data.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6">
                    <p className="text-sm text-neutral-500">
                      Showing {(page - 1) * data.pageSize + 1} to {Math.min(page * data.pageSize, data.total)} of{' '}
                      {data.total} templates
                    </p>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 1}>
                        Previous
                      </Button>
                      <span className="text-sm text-neutral-700">
                        Page {page} of {data.totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => p + 1)}
                        disabled={page === data.totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <ConfirmDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          onConfirm={handleDelete}
          title="Delete Template"
          description="Are you sure you want to delete this template? This action cannot be undone."
          confirmText="Delete"
          variant="destructive"
        />
      </DashboardLayout>
    </>
  );
}
