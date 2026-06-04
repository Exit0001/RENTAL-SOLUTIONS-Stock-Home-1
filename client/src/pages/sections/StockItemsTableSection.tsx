import React, { useState } from "react";
import { ChevronRightIcon, Pencil, Trash2, Eye, Package } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { stockItems } from "@/data/stock";
import type { StockItem } from "@/data/stock";

const StatusBadge = ({ status }: { status: string }) => {
  const isAvailable = status === "Available";
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
        isAvailable
          ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/50"
          : "bg-red-950/60 text-red-400 border border-red-800/50"
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
          isAvailable ? "bg-emerald-400" : "bg-red-400"
        }`}
      />
      {status}
    </span>
  );
};

const ActionIcons = ({ onView, onEdit }: { onView?: () => void; onEdit?: () => void }) => (
  <div className="flex items-center gap-1">
    <button onClick={(e) => { e.stopPropagation(); onView?.(); }}
      className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors" title="View details">
      <Eye className="w-4 h-4" />
    </button>
    <button onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
      className="p-1.5 rounded-md text-white/40 hover:bg-white/10 transition-colors" title="Edit"
      style={{ color: "inherit" }}
      onMouseEnter={e => (e.currentTarget.style.color = "#FFFF00")}
      onMouseLeave={e => (e.currentTarget.style.color = "")}
    >
      <Pencil className="w-4 h-4" />
    </button>
    <button onClick={(e) => e.stopPropagation()}
      className="p-1.5 rounded-md text-white/40 hover:text-red-400 hover:bg-red-400/10 transition-colors" title="Delete">
      <Trash2 className="w-4 h-4" />
    </button>
  </div>
);

interface StockItemsTableProps {
  selectedBrands?: string[];
  selectedCategories?: string[];
  searchQuery?: string;
  onViewItem?: (item: StockItem) => void;
  selectedItemId?: number | null;
}

export const StockItemsTableSection = ({
  selectedBrands = [],
  selectedCategories = [],
  searchQuery = "",
  onViewItem,
  selectedItemId,
}: StockItemsTableProps): JSX.Element => {
  const [expandedRows, setExpandedRows] = useState<number[]>(
    stockItems.filter((item) => item.expanded).map((item) => item.id),
  );

  const toggleRow = (id: number) => {
    setExpandedRows((prev) =>
      prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id],
    );
  };

  const filteredItems = stockItems.filter((item) => {
    const brandMatch = selectedBrands.length === 0 || selectedBrands.includes(item.brand);
    const categoryMatch = selectedCategories.length === 0 || selectedCategories.includes(item.category);
    const q = searchQuery.toLowerCase();
    const searchMatch =
      !q ||
      item.name.toLowerCase().includes(q) ||
      item.brand.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.subCategory.toLowerCase().includes(q);
    return brandMatch && categoryMatch && searchMatch;
  });

  return (
    <section className="w-full bg-[#0f0f0f] rounded-xl border border-white/10 overflow-hidden animate-fade-in">
      <div className="px-6 py-4 border-b border-white/10 flex items-center gap-3">
        <Package className="w-5 h-5 text-[#FFFF00]" />
        <h2 className="font-bold text-[#FFFF00] text-base tracking-widest uppercase">
          Stock Items
        </h2>
        <span className="ml-auto text-xs text-white/30 font-medium">
          {filteredItems.length} {filteredItems.length === 1 ? "category" : "categories"}
          {(selectedBrands.length > 0 || selectedCategories.length > 0 || searchQuery) && (
            <span className="ml-1 text-[#FFFF00]/50">· filtered</span>
          )}
        </span>
      </div>

      <div className="overflow-x-auto">
        {/* Single unified table — no fixed widths so columns spread full width */}
        <Table className="w-full table-fixed">
          <colgroup>
            <col className="w-[22%]" />
            <col className="w-[18%]" />
            <col className="w-[14%]" />
            <col className="w-[16%]" />
            <col className="w-[12%]" />
            <col className="w-[18%]" />
          </colgroup>

          <TableHeader>
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead className="py-3 pl-6 font-bold text-[#FFFF00] text-xs uppercase tracking-wider">
                Name
              </TableHead>
              <TableHead className="py-3 font-bold text-[#FFFF00] text-xs uppercase tracking-wider">
                Brand
              </TableHead>
              <TableHead className="py-3 font-bold text-[#FFFF00] text-xs uppercase tracking-wider">
                Category
              </TableHead>
              <TableHead className="py-3 font-bold text-[#FFFF00] text-xs uppercase tracking-wider">
                Sub-Category
              </TableHead>
              <TableHead className="py-3 font-bold text-[#FFFF00] text-xs uppercase tracking-wider">
                Qty
              </TableHead>
              <TableHead className="py-3 pr-6 text-right font-bold text-[#FFFF00] text-xs uppercase tracking-wider">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filteredItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Package className="w-8 h-8 text-white/10" />
                    <p className="text-white/30 text-sm">No items match your filters</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {filteredItems.flatMap((item) => {
              const isExpanded = expandedRows.includes(item.id);
              const isSelected = selectedItemId === item.id;
              const rows: JSX.Element[] = [
                <TableRow
                  key={`row-${item.id}`}
                  className={`cursor-pointer border-white/5 transition-colors ${
                    isSelected
                      ? "bg-[#FFFF00]/[0.05] border-l-2 border-l-[#FFFF00]/50"
                      : "bg-[#1e1e1e] hover:bg-[#252525]"
                  }`}
                  onClick={() => toggleRow(item.id)}
                >
                  <TableCell className="py-3 pl-6">
                    <div className="flex items-center gap-2.5">
                      <ChevronRightIcon
                        className={`w-4 h-4 flex-shrink-0 transition-all duration-300 ease-in-out ${
                          isExpanded ? "rotate-90 text-[#FFFF00]" : "text-white/40"
                        }`}
                      />
                      <span className={`font-semibold text-sm truncate ${isSelected ? "text-[#FFFF00]" : "text-white"}`}>
                        {item.name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 text-white/70 text-sm truncate align-middle">
                    {item.brand}
                  </TableCell>
                  <TableCell className="py-3 text-white/70 text-sm truncate align-middle">
                    {item.category}
                  </TableCell>
                  <TableCell className="py-3 text-white/70 text-sm truncate align-middle">
                    {item.subCategory}
                  </TableCell>
                  <TableCell className="py-3 text-sm align-middle">
                    <span className="font-bold text-white">{item.quantity}</span>
                    <span className="text-white/30 text-xs ml-1">units</span>
                  </TableCell>
                  <TableCell className="py-3 pr-6 text-right align-middle">
                    <ActionIcons
                      onView={() => onViewItem?.(item)}
                      onEdit={() => onViewItem?.(item)}
                    />
                  </TableCell>
                </TableRow>,
              ];

              if (isExpanded && item.subItems.length > 0) {
                rows.push(
                  <TableRow key={`subhead-${item.id}`} className="animate-slide-down bg-[#111111] border-white/5 hover:bg-[#111111]">
                    <TableCell className="py-2 pl-12 font-semibold text-[#FFFF00]/30 text-xs uppercase tracking-wider">
                      Unit Name
                    </TableCell>
                    <TableCell className="py-2 font-semibold text-[#FFFF00]/30 text-xs uppercase tracking-wider">
                      Serial No.
                    </TableCell>
                    <TableCell className="py-2 font-semibold text-[#FFFF00]/30 text-xs uppercase tracking-wider">
                      Barcode
                    </TableCell>
                    <TableCell className="py-2 font-semibold text-[#FFFF00]/30 text-xs uppercase tracking-wider">
                      Location
                    </TableCell>
                    <TableCell className="py-2 font-semibold text-[#FFFF00]/30 text-xs uppercase tracking-wider">
                      Status
                    </TableCell>
                    <TableCell className="py-2 pr-6 text-right font-semibold text-[#FFFF00]/30 text-xs uppercase tracking-wider">
                      Actions
                    </TableCell>
                  </TableRow>,
                );

                item.subItems.forEach((subItem, subIdx) => {
                  rows.push(
                    <TableRow
                      key={`sub-${item.id}-${subItem.id}`}
                      className="animate-slide-down bg-[#131313] border-white/5 hover:bg-white/5 transition-colors"
                      style={{ animationDelay: `${subIdx * 40}ms` }}
                    >
                      <TableCell className="py-2.5 pl-12 text-white/80 text-sm truncate align-middle">
                        {subItem.name}
                      </TableCell>
                      <TableCell className="py-2.5 text-white/60 text-sm font-mono truncate align-middle">
                        {subItem.serialNumber}
                      </TableCell>
                      <TableCell className="py-2.5 text-white/60 text-sm font-mono truncate align-middle">
                        {subItem.barcodeNumber}
                      </TableCell>
                      <TableCell className="py-2.5 text-white/60 text-sm truncate align-middle">
                        {subItem.location}
                      </TableCell>
                      <TableCell className="py-2.5 align-middle">
                        <StatusBadge status={subItem.status} />
                      </TableCell>
                      <TableCell className="py-2.5 pr-4 text-right align-middle">
                        <ActionIcons />
                      </TableCell>
                    </TableRow>,
                  );
                });
              }

              return rows;
            })}
          </TableBody>
        </Table>
      </div>
    </section>
  );
};
