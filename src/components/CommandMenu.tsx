import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Home,
  Users,
  FileText,
  Landmark,
  BarChart3,
  Settings,
  Building2,
  Plus,
  Upload,
  Search,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import './CommandMenu.css';

interface CommandMenuProps {
  onNavigate: (view: string, data?: any) => void;
}

interface CommandItem {
  id: string;
  icon: any;
  label: string;
  onSelect: () => void;
  group: string;
  keywords?: string;
  subtitle?: string;
}

export function CommandMenu({ onNavigate }: CommandMenuProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [contacts, setContacts] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const baseItems: CommandItem[] = [
    {
      id: 'nav-dashboard',
      icon: Home,
      label: 'Go to Dashboard',
      onSelect: () => onNavigate('dashboard'),
      group: 'Navigation',
      keywords: 'home dashboard',
    },
    {
      id: 'nav-outstanding',
      icon: Users,
      label: 'Go to Open Items',
      onSelect: () => onNavigate('outstanding'),
      group: 'Navigation',
      keywords: 'open items outstanding',
    },
    {
      id: 'nav-relations',
      icon: Building2,
      label: 'Go to Relations',
      onSelect: () => onNavigate('relations'),
      group: 'Navigation',
      keywords: 'relations contacts customers',
    },
    {
      id: 'nav-bank',
      icon: Landmark,
      label: 'Go to Bank',
      onSelect: () => onNavigate('bank'),
      group: 'Navigation',
      keywords: 'bank transactions',
    },
    {
      id: 'nav-reports',
      icon: BarChart3,
      label: 'Go to Reports',
      onSelect: () => onNavigate('reports'),
      group: 'Navigation',
      keywords: 'reports analytics',
    },
    {
      id: 'nav-settings',
      icon: Settings,
      label: 'Go to Settings',
      onSelect: () => onNavigate('settings'),
      group: 'Navigation',
      keywords: 'settings preferences',
    },
    {
      id: 'action-upload',
      icon: Upload,
      label: 'Upload Receipt',
      onSelect: () => onNavigate('inbox'),
      group: 'Actions',
      keywords: 'upload receipt inbox',
    },
    {
      id: 'action-invoice',
      icon: FileText,
      label: 'New Invoice',
      onSelect: () => onNavigate('settings', { tab: 'invoices' }),
      group: 'Actions',
      keywords: 'new invoice create',
    },
    {
      id: 'action-contact',
      icon: Plus,
      label: 'Add Contact',
      onSelect: () => onNavigate('relations'),
      group: 'Actions',
      keywords: 'add contact new customer',
    },
  ];

  // Build dynamic items from search results
  const dynamicItems: CommandItem[] = [
    ...contacts.map((contact) => ({
      id: `contact-${contact.id}`,
      icon: Building2,
      label: contact.company_name,
      subtitle: contact.email,
      onSelect: () => onNavigate('relations'),
      group: 'Contacts',
      keywords: contact.company_name + ' ' + (contact.email || ''),
    })),
    ...invoices.map((invoice) => ({
      id: `invoice-${invoice.id}`,
      icon: FileText,
      label: invoice.invoice_number,
      subtitle: `${invoice.contact?.company_name} • €${Number(invoice.total_amount).toFixed(2)}`,
      onSelect: () => onNavigate('settings', { tab: 'invoices' }),
      group: 'Invoices',
      keywords: invoice.invoice_number,
    })),
  ];

  // Filter items based on search
  const filteredItems = [...baseItems, ...dynamicItems].filter((item) => {
    if (!search) return baseItems.includes(item);
    const searchLower = search.toLowerCase();
    return (
      item.label.toLowerCase().includes(searchLower) ||
      item.keywords?.toLowerCase().includes(searchLower) ||
      item.subtitle?.toLowerCase().includes(searchLower)
    );
  });

  // Group items
  const groupedItems = filteredItems.reduce((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {} as Record<string, CommandItem[]>);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }

      if (open) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setOpen(false);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, filteredItems.length - 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (filteredItems[selectedIndex]) {
            handleSelect(filteredItems[selectedIndex].onSelect);
          }
        }
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, filteredItems, selectedIndex]);

  useEffect(() => {
    if (open && search.length > 1) {
      searchData(search);
    }
    setSelectedIndex(0);
  }, [search]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setContacts([]);
      setInvoices([]);
      setSelectedIndex(0);
    }
  }, [open]);

  const searchData = useCallback(async (query: string) => {
    try {
      const [contactsResponse, invoicesResponse] = await Promise.all([
        supabase
          .from('contacts')
          .select('id, company_name, email')
          .ilike('company_name', `%${query}%`)
          .limit(5),
        supabase
          .from('invoices')
          .select('id, invoice_number, total_amount, contact:contacts(company_name)')
          .or(`invoice_number.ilike.%${query}%`)
          .limit(5),
      ]);

      setContacts(contactsResponse.data || []);
      setInvoices(invoicesResponse.data || []);
    } catch (error) {
      console.error('Search error:', error);
    }
  }, []);

  const handleSelect = useCallback((callback: () => void) => {
    setOpen(false);
    setSearch('');
    callback();
  }, []);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="hidden lg:flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
      >
        <Search className="w-4 h-4" />
        <span>Search...</span>
        <kbd className="ml-2 px-1.5 py-0.5 text-xs bg-white rounded border border-slate-300">
          ⌘K
        </kbd>
      </button>
    );
  }

  let currentIndex = 0;

  return (
    <div
      className="command-dialog"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setOpen(false);
        }
      }}
    >
      <div className="command-dialog-content">
        <input
          ref={inputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Type a command or search..."
          className="command-input"
        />

        <div className="command-list" ref={listRef}>
          {filteredItems.length === 0 ? (
            <div className="command-empty">No results found.</div>
          ) : (
            <>
              {Object.entries(groupedItems).map(([group, items], groupIndex) => (
                <div key={group}>
                  {groupIndex > 0 && <div className="command-separator" />}
                  <div className="command-group">
                    <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {group}
                    </div>
                    {items.map((item) => {
                      const itemIndex = currentIndex++;
                      const Icon = item.icon;
                      return (
                        <div
                          key={item.id}
                          className="command-item"
                          aria-selected={itemIndex === selectedIndex}
                          onClick={() => handleSelect(item.onSelect)}
                          onMouseEnter={() => setSelectedIndex(itemIndex)}
                        >
                          <Icon className="w-4 h-4" />
                          <div className="flex-1">
                            <div className="font-medium">{item.label}</div>
                            {item.subtitle && (
                              <div className="text-xs text-slate-500">{item.subtitle}</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
