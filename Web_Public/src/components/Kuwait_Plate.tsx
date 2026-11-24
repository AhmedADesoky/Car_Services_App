'use client';

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
export const toArabicDigits = (latin: string) => latin.replace(/\d/g, (d) => ARABIC_DIGITS[Number(d)]);

/**
 * Kuwaiti private-car plate: white plate, "الكويت / KUWAIT" strip on the left, then the code and the number,
 * each written twice - Arabic-Indic digits on top, English digits below.
 * `glyph` lets the hero animation swap characters while "decoding".
 */
export function Kuwait_Plate({ code, number, size = 'lg', glyph }: {
  code: string; number: string; size?: 'lg' | 'sm' | 'xs'; glyph?: (char: string, index: number, arabic: boolean) => string;
}) {
  const show = (text: string, offset: number, arabic: boolean) =>
    [...text].map((c, i) => (glyph ? glyph(c, offset + i, arabic) : arabic ? toArabicDigits(c) : c));
  const big = size === 'lg' ? 'text-3xl sm:text-4xl' : size === 'sm' ? 'text-xl' : 'text-[15px]';
  const small = size === 'lg' ? 'text-lg sm:text-xl' : size === 'sm' ? 'text-sm' : 'text-[10px]';
  const border = size === 'xs' ? 'border-2 rounded-md' : 'border-[3px] rounded-xl';
  return (
    <div dir="ltr" className={`flex overflow-hidden ${border} border-ink bg-white text-ink`}>
      <div className={`flex flex-col items-center justify-center bg-[#eef3f8] font-extrabold leading-tight ${size === 'xs' ? 'px-1 text-[6px]' : size === 'sm' ? 'px-1.5 text-[8px]' : 'px-2.5 text-[10px]'}`}>
        <span className="font-arabic">الكويت</span>
        <span className="tracking-wider">KUWAIT</span>
        {/* Kuwait flag colours as a thin accent */}
        <span className={`mt-0.5 flex w-full overflow-hidden rounded-sm ${size === 'xs' ? 'h-[2px]' : 'h-[3px]'}`}>
          <span className="flex-1 bg-[#007a3d]" /><span className="flex-1 bg-white" /><span className="flex-1 bg-[#ce1126]" /><span className="w-1 bg-black" />
        </span>
      </div>
      <div className="flex flex-1 divide-x-2 divide-ink/80">
        <PlateCell big={big} small={small} arabic={show(code, 0, true)} latin={show(code, 0, false)} narrow />
        <PlateCell big={big} small={small} arabic={show(number, code.length, true)} latin={show(number, code.length, false)} />
      </div>
    </div>
  );
}

function PlateCell({ arabic, latin, big, small, narrow = false }: { arabic: string[]; latin: string[]; big: string; small: string; narrow?: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center py-1 ${narrow ? 'px-2' : 'flex-1 px-2'}`}>
      <div className={`font-arabic font-extrabold leading-none ${big}`}>{arabic.map((c, i) => <span key={i}>{c}</span>)}</div>
      <div className={`mt-0.5 font-mono font-bold leading-none tracking-wider ${small}`}>{latin.map((c, i) => <span key={i}>{c}</span>)}</div>
    </div>
  );
}
