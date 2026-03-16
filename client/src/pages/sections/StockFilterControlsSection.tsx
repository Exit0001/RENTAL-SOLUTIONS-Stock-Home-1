import { Button } from "@/components/ui/button";

export const StockFilterControlsSection = (): JSX.Element => {
  return (
    <div className="flex flex-row items-center gap-3 w-full h-[55px] px-2">
      {/* FILTER button */}
      <Button
        className="h-[55px] px-8 bg-white text-black rounded-[45px] hover:bg-white/90 [font-family:'Inter',Helvetica] font-bold text-xl tracking-[0] leading-[normal] shrink-0"
        variant="ghost"
      >
        FILTER
      </Button>

      {/* SearchIcon field */}
      <div className="relative flex items-center h-[55px] w-[326px] bg-[#ffff001a] rounded-[45px] shrink-0">
        <img
          className="absolute left-3.5 w-[47px] h-[47px] object-cover"
          alt="Magnifying"
          src="/figmaAssets/magnifying.png"
        />
        <span className="ml-20 [font-family:'Inter',Helvetica] font-bold text-[#ffffff4c] text-xl tracking-[0] leading-[normal] whitespace-nowrap">
          SearchIcon For Items...
        </span>
      </div>

      {/* Add Brand & Category button */}
      <Button
        className="h-[55px] px-[22px] bg-white text-black rounded-[45px] hover:bg-white/90 [font-family:'Inter',Helvetica] font-bold text-xl tracking-[0] leading-[normal] shrink-0"
        variant="ghost"
      >
        Add Brand&amp;Catergory
      </Button>

      {/* Add New Item button */}
      <Button
        className="h-[55px] px-[22px] bg-white text-black rounded-[45px] hover:bg-white/90 [font-family:'Inter',Helvetica] font-bold text-xl tracking-[0] leading-[normal] shrink-0"
        variant="ghost"
      >
        Add New Item
      </Button>
    </div>
  );
};
