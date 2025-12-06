import { IDatafeed, IOhlcvData } from "@/types/datafeed.type";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getImageUrl = (address: string) =>
  `https://api.dextrading.com/images/${address.toLowerCase()}.png`;


export const getOhlcvData = (data: IDatafeed): IOhlcvData[] => {
  if (!data.data) return [];
  return data.data.attributes.ohlcv_list
    .map((item) => ({
      time: item[0],
      open: item[1],
      high: item[2],
      low: item[3],
      close: item[4],
      volume: item[5],
    }))
    .sort((a, b) => a.time - b.time);
};

export const mergeOhlcvData = (
  minuteData: IOhlcvData[],
  hourData: IOhlcvData[],
  dayData: IOhlcvData[]
): IOhlcvData[] => {
  const mergedData: IOhlcvData[] = [];
  let i = 0,
    j = 0,
    k = 0;

  while (i < minuteData.length || j < hourData.length || k < dayData.length) {
    const minuteTime = i < minuteData.length ? minuteData[i].time : Infinity;
    const hourTime = j < hourData.length ? hourData[j].time : Infinity;
    const dayTime = k < dayData.length ? dayData[k].time : Infinity;

    const minTime = Math.min(minuteTime, hourTime, dayTime);

    if (
      minuteTime === minTime &&
      hourTime === minTime &&
      dayTime === minTime
    ) {
      mergedData.push(dayData[k]); // Prefer dayData when all match
      i++;
      j++;
      k++;
    } else if (hourTime === minTime && minuteTime === minTime) {
      mergedData.push(hourData[j]); // Prefer hourData over minuteData
      i++;
      j++;
    } else if (dayTime === minTime && hourTime === minTime) {
      mergedData.push(dayData[k]); // Prefer dayData over hourData
      j++;
      k++;
    } else if (dayTime === minTime) {
      mergedData.push(dayData[k]);
      k++;
    } else if (hourTime === minTime) {
      mergedData.push(hourData[j]);
      j++;
    } else if (minuteTime === minTime) {
      mergedData.push(minuteData[i]);
      i++;
    }
  }

  return mergedData;
};