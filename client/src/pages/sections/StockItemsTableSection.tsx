import { ChevronDownIcon, ChevronRightIcon, Pencil, Trash2, Eye, Package } from "lucide-react";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Data for the main stock items
const stockItems = [
  {
    id: 1,
    name: "J8 loudspeaker",
    brand: "d&b audiotechnik",
    category: "Speakers",
    subCategory: "Line Array",
    quantity: 24,
    expanded: true,
    subItems: [
      {
        id: 1,
        name: "J8 Top1",
        serialNumber: "Z33057252456",
        barcodeNumber: "DBJ8-1",
        location: "Zone A1",
        status: "Available",
      },
      {
        id: 2,
        name: "J8 Top1",
        serialNumber: "Z33057252456",
        barcodeNumber: "DBJ8-1",
        location: "Zone A1",
        status: "Available",
      },
      {
        id: 3,
        name: "J8 Top1",
        serialNumber: "Z33057252456",
        barcodeNumber: "DBJ8-1",
        location: "Zone A1",
        status: "Available",
      },
      {
        id: 4,
        name: "J8 Top1",
        serialNumber: "Z33057252456",
        barcodeNumber: "DBJ8-1",
        location: "Zone A1",
        status: "Maintenace",
      },
    ],
  },
  {
    id: 2,
    name: "GSL8 loudspeaker",
    brand: "d&b audiotechnik",
    category: "Speakers",
    subCategory: "Line Array",
    quantity: 10,
    expanded: false,
    subItems: [],
  },
];

const StatusBadge = ({ status }: { status: string }) => {
  const isAvailable = status === "Available";
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
        isAvailable
          ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/50"
          : "bg-orange-950/60 text-orange-400 border border-orange-800/50"
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isAvailable ? "bg-emerald-400" : "bg-orange-400"}`}
      />
      {status}
    </span>
  );
};

const ActionIcons = () => (
  <div className="flex items-center gap-1">
    <button className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors" title="View">
      <Eye className="w-4 h-4" />
    </button>
    <button className="p-1.5 rounded-md text-white/40 hover:text-blue-400 hover:bg-blue-400/10 transition-colors" title="Edit">
      <Pencil className="w-4 h-4" />
    </button>
    <button className="p-1.5 rounded-md text-white/40 hover:text-red-400 hover:bg-red-400/10 transition-colors" title="Delete">
      <Trash2 className="w-4 h-4" />
    </button>
  </div>
);

export const StockItemsTableSection = (): JSX.Element => {
  const [expandedRows, setExpandedRows] = useState<number[]>(
    stockItems.filter((item) => item.expanded).map((item) => item.id),
  );

  const toggleRow = (id: number) => {
    setExpandedRows((prev) =>
      prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id],
    );
  };

  return (
    <section className="w-full bg-[#0f0f0f] rounded-xl border border-white/10 overflow-hidden">
      <div className="px-6 py-4 border-b border-white/10 flex items-center gap-3">
        <Package className="w-5 h-5 text-yellow-400" />
        <h2 className="font-bold text-yellow-400 text-base tracking-widest uppercase">
          Stock Items
        </h2>
        <span className="ml-auto text-xs text-white/30 font-medium">
          {stockItems.length} categories
        </span>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead className="py-3 pl-6 font-bold text-yellow-400 text-xs uppercase tracking-wider whitespace-nowrap">
                Name
              </TableHead>
              <TableHead className="py-3 font-bold text-yellow-400 text-xs uppercase tracking-wider whitespace-nowrap">
                Brand
              </TableHead>
              <TableHead className="py-3 font-bold text-yellow-400 text-xs uppercase tracking-wider whitespace-nowrap">
                Category
              </TableHead>
              <TableHead className="py-3 font-bold text-yellow-400 text-xs uppercase tracking-wider whitespace-nowrap">
                Sub-Category
              </TableHead>
              <TableHead className="py-3 font-bold text-yellow-400 text-xs uppercase tracking-wider whitespace-nowrap">
                Qty
              </TableHead>
              <TableHead className="py-3 pr-6 text-right font-bold text-yellow-400 text-xs uppercase tracking-wider whitespace-nowrap">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
        </Table>

        {stockItems.map((item) => {
          const isExpanded = expandedRows.includes(item.id);
          return (
            <div key={item.id} className="border-t border-white/5">
              <div
                className="bg-[#1e1e1e] hover:bg-[#252525] cursor-pointer transition-colors"
                onClick={() => toggleRow(item.id)}
              >
                <Table>
                  <TableBody>
                    <TableRow className="border-0 hover:bg-transparent">
                      <TableCell className="py-3 pl-6">
                        <div className="flex items-center gap-2.5">
                          {isExpanded ? (
                            <ChevronDownIcon className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                          ) : (
                            <ChevronRightIcon className="w-4 h-4 text-white/40 flex-shrink-0" />
                          )}
                          <img
                            className="w-5 h-5 object-contain flex-shrink-0 opacity-80"
                            alt=""
                            src="/figmaAssets/image-4--colorized---colorized--1.png"
                          />
                          <span className="font-semibold text-white text-sm whitespace-nowrap">
                            {item.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3 text-white/70 text-sm whitespace-nowrap">
                        {item.brand}
                      </TableCell>
                      <TableCell className="py-3 text-white/70 text-sm whitespace-nowrap">
                        {item.category}
                      </TableCell>
                      <TableCell className="py-3 text-white/70 text-sm whitespace-nowrap">
                        {item.subCategory}
                      </TableCell>
                      <TableCell className="py-3 text-sm">
                        <span className="font-bold text-white">{item.quantity}</span>
                        <span className="text-white/30 text-xs ml-1">units</span>
                      </TableCell>
                      <TableCell className="py-3 pr-6 text-right">
                        <span className="text-xs text-yellow-400/60 italic">
                          {isExpanded ? "Collapse" : "More details"}
                        </span>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {isExpanded && item.subItems.length > 0 && (
                <div className="bg-[#121212]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/5 hover:bg-transparent">
                        <TableHead className="py-2 pl-12 font-semibold text-yellow-200/60 text-xs uppercase tracking-wider whitespace-nowrap">
                          Unit Name
                        </TableHead>
                        <TableHead className="py-2 font-semibold text-yellow-200/60 text-xs uppercase tracking-wider whitespace-nowrap">
                          Serial No.
                        </TableHead>
                        <TableHead className="py-2 font-semibold text-yellow-200/60 text-xs uppercase tracking-wider whitespace-nowrap">
                          Barcode
                        </TableHead>
                        <TableHead className="py-2 font-semibold text-yellow-200/60 text-xs uppercase tracking-wider whitespace-nowrap">
                          Location
                        </TableHead>
                        <TableHead className="py-2 font-semibold text-yellow-200/60 text-xs uppercase tracking-wider whitespace-nowrap">
                          Status
                        </TableHead>
                        <TableHead className="py-2 pr-6 text-right font-semibold text-yellow-200/60 text-xs uppercase tracking-wider">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {item.subItems.map((subItem) => (
                        <TableRow
                          key={subItem.id}
                          className="border-white/5 hover:bg-white/5 transition-colors"
                        >
                          <TableCell className="py-2.5 pl-12 text-white/80 text-sm whitespace-nowrap">
                            {subItem.name}
                          </TableCell>
                          <TableCell className="py-2.5 text-white/60 text-sm font-mono whitespace-nowrap">
                            {subItem.serialNumber}
                          </TableCell>
                          <TableCell className="py-2.5 text-white/60 text-sm font-mono whitespace-nowrap">
                            {subItem.barcodeNumber}
                          </TableCell>
                          <TableCell className="py-2.5 text-white/60 text-sm whitespace-nowrap">
                            {subItem.location}
                          </TableCell>
                          <TableCell className="py-2.5">
                            <StatusBadge status={subItem.status} />
                          </TableCell>
                          <TableCell className="py-2.5 pr-4 text-right">
                            <ActionIcons />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
