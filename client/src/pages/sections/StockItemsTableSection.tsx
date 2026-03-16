import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
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

// Status badge component
const StatusBadge = ({ status }: { status: string }) => {
  if (status === "Available") {
    return (
      <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-[#1a3431] text-[#558e88] text-sm [font-family:'Inter',Helvetica] font-normal whitespace-nowrap">
        {status}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-[#422523] text-[#c8a29f] text-sm [font-family:'Inter',Helvetica] font-normal whitespace-nowrap">
      {status}
    </span>
  );
};

// Action icons for sub-rows
const ActionIcons = () => (
  <div className="flex items-center gap-3">
    <img
      className="w-[93px] h-[34px] object-cover"
      alt="Actions"
      src="/figmaAssets/image-6-3.png"
    />
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
    <section className="relative w-full bg-[#0f0f0f] rounded-[29px] border border-solid border-[#ffffff80] p-0 overflow-hidden">
      {/* Section Title */}
      <div className="px-8 pt-7 pb-5">
        <h2 className="[font-family:'Inter',Helvetica] font-bold text-[#ffff00] text-[32px] tracking-[0] leading-[normal]">
          STOCK ITEMS
        </h2>
      </div>

      {/* Inner table container */}
      <div className="mx-8 mb-8 bg-neutral-900 rounded-[29px] border-b border-solid border-[#ffffff80] overflow-hidden">
        {/* Outer table header */}
        <div className="bg-neutral-800 rounded-t-[29px]">
          <Table>
            <TableHeader>
              <TableRow className="border-0 hover:bg-transparent">
                <TableHead className="w-[400px] py-6 pl-8 [font-family:'Inter',Helvetica] font-extrabold text-[#ffff00] text-2xl tracking-[0] leading-[normal] whitespace-nowrap">
                  Name
                </TableHead>
                <TableHead className="py-6 [font-family:'Inter',Helvetica] font-bold text-[#ffff00] text-2xl tracking-[0] leading-[normal] whitespace-nowrap">
                  Brand
                </TableHead>
                <TableHead className="py-6 [font-family:'Inter',Helvetica] font-bold text-[#ffff00] text-2xl tracking-[0] leading-[normal] whitespace-nowrap">
                  Category
                </TableHead>
                <TableHead className="py-6 [font-family:'Inter',Helvetica] font-bold text-[#ffff00] text-2xl tracking-[0] leading-[normal] whitespace-nowrap">
                  Sub-Category
                </TableHead>
                <TableHead className="py-6 [font-family:'Inter',Helvetica] font-bold text-[#ffff00] text-2xl tracking-[0] leading-[normal] whitespace-nowrap">
                  Quantity
                </TableHead>
                <TableHead className="py-6" />
              </TableRow>
            </TableHeader>
          </Table>
        </div>

        {/* Stock items rows */}
        {stockItems.map((item) => {
          const isExpanded = expandedRows.includes(item.id);
          return (
            <div key={item.id}>
              {/* Main row - dark gray background */}
              <div
                className="bg-[#323232] cursor-pointer"
                onClick={() => toggleRow(item.id)}
              >
                <Table>
                  <TableBody>
                    <TableRow className="border-0 hover:bg-[#3a3a3a]">
                      <TableCell className="w-[400px] py-4 pl-8">
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronDownIcon className="w-5 h-5 text-white flex-shrink-0" />
                          ) : (
                            <ChevronRightIcon className="w-5 h-5 text-white flex-shrink-0" />
                          )}
                          <img
                            className="w-[25px] h-[25px] object-cover flex-shrink-0"
                            alt="Image colorized"
                            src="/figmaAssets/image-4--colorized---colorized--1.png"
                          />
                          <span className="[font-family:'Inter',Helvetica] font-semibold text-white text-xl tracking-[0] leading-[normal] whitespace-nowrap">
                            {item.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 [font-family:'Inter',Helvetica] font-semibold text-white text-xl tracking-[0] leading-[normal] whitespace-nowrap">
                        {item.brand}
                      </TableCell>
                      <TableCell className="py-4 [font-family:'Inter',Helvetica] font-semibold text-white text-xl tracking-[0] leading-[normal] whitespace-nowrap">
                        {item.category}
                      </TableCell>
                      <TableCell className="py-4 [font-family:'Inter',Helvetica] font-semibold text-white text-xl tracking-[0] leading-[normal] whitespace-nowrap">
                        {item.subCategory}
                      </TableCell>
                      <TableCell className="py-4 [font-family:'Inter',Helvetica] font-semibold text-white text-xl tracking-[0] leading-[normal] whitespace-nowrap">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="py-4 text-right pr-8">
                        <span className="[font-family:'Inter',Helvetica] font-light italic text-white text-xl tracking-[0] leading-[normal] whitespace-nowrap">
                          More Details
                        </span>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* Expanded sub-table */}
              {isExpanded && item.subItems.length > 0 && (
                <div className="bg-[#0f0f0f]">
                  {/* Sub-table header */}
                  <div className="border-b border-solid border-white/50">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-0 hover:bg-transparent">
                          <TableHead className="w-[400px] py-4 pl-8 [font-family:'Inter',Helvetica] font-extrabold text-[#ffffa6] text-xl tracking-[0] leading-[normal] whitespace-nowrap">
                            Name
                          </TableHead>
                          <TableHead className="py-4 [font-family:'Inter',Helvetica] font-bold text-[#ffffa6] text-xl tracking-[0] leading-[normal] whitespace-nowrap">
                            Serial Number
                          </TableHead>
                          <TableHead className="py-4 [font-family:'Inter',Helvetica] font-bold text-[#ffffa6] text-xl tracking-[0] leading-[normal] whitespace-nowrap">
                            Barcode Number
                          </TableHead>
                          <TableHead className="py-4 [font-family:'Inter',Helvetica] font-bold text-[#ffffa6] text-xl tracking-[0] leading-[normal] whitespace-nowrap">
                            Location
                          </TableHead>
                          <TableHead className="py-4 [font-family:'Inter',Helvetica] font-bold text-[#ffffa6] text-xl tracking-[0] leading-[normal] whitespace-nowrap">
                            Status
                          </TableHead>
                          <TableHead className="py-4" />
                        </TableRow>
                      </TableHeader>
                    </Table>
                  </div>

                  {/* Sub-table rows */}
                  <Table>
                    <TableBody>
                      {item.subItems.map((subItem) => (
                        <TableRow
                          key={subItem.id}
                          className="border-0 hover:bg-[#1a1a1a]"
                        >
                          <TableCell className="w-[400px] py-4 pl-8 [font-family:'Inter',Helvetica] font-normal text-white text-xl tracking-[0] leading-[normal] whitespace-nowrap">
                            {subItem.name}
                          </TableCell>
                          <TableCell className="py-4 [font-family:'Inter',Helvetica] font-normal text-white text-xl tracking-[0] leading-[normal] whitespace-nowrap">
                            {subItem.serialNumber}
                          </TableCell>
                          <TableCell className="py-4 [font-family:'Inter',Helvetica] font-normal text-white text-xl tracking-[0] leading-[normal] whitespace-nowrap">
                            {subItem.barcodeNumber}
                          </TableCell>
                          <TableCell className="py-4 [font-family:'Inter',Helvetica] font-normal text-white text-xl tracking-[0] leading-[normal] whitespace-nowrap">
                            {subItem.location}
                          </TableCell>
                          <TableCell className="py-4">
                            <StatusBadge status={subItem.status} />
                          </TableCell>
                          <TableCell className="py-4 pr-8 text-right">
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
