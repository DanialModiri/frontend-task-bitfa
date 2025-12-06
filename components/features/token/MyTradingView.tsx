import { Dialog } from "@/components/ui/dialog";
import {
  ChartingLibraryWidgetOptions,
  IBasicDataFeed,
  IChartingLibraryWidget,
  IDatafeedQuotesApi,
  ResolutionString,
  widget as TradingViewWidget,
} from "@/public/static/charting_library";
import { IDatafeed, IOhlcvData } from "@/types/datafeed.type";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useRef, useState } from "react";
import LogoSelect from "./LogoSelect";
import { Daum } from "@/types/token.type";
import { getDataFeed } from "@/services/http/token.http";
import { getOhlcvData, mergeOhlcvData } from "@/lib/utils";

interface Props {
  chartOptions: Partial<ChartingLibraryWidgetOptions>;
  ohlcvData: IOhlcvData[];
  className?: string;
  tokenDescription: string;
  tokenExchange: string;
  theme: "dark" | "light";
  customSymbols?: Array<{
    symbol: string;
    full_name: string;
    description: string;
  }>;
}

interface IChartingLibraryWidgetCustom extends IChartingLibraryWidget {
  _options?: any
}

let intervalId: NodeJS.Timeout;


const MyTradingView = ({
  chartOptions,
  ohlcvData,
  theme,
  tokenDescription,
  tokenExchange,
  customSymbols = [],
}: Props) => {
  const chartContainerRef =
    useRef<HTMLDivElement>() as React.MutableRefObject<HTMLInputElement>;
  const [chartIsReady, setChartIsReady] = useState(false);
  const myWidget = useRef<IChartingLibraryWidgetCustom>(undefined!);
  const compareingData = useRef<{ [name: string]: Daum & { bars?: any[] } }>({});
  const pathname = usePathname();
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false)

  const dataFeed = (
    ohlcvData: IOhlcvData[],
    tokenDescription: string,
    tokenExchange: string
  ): IBasicDataFeed | (IBasicDataFeed & IDatafeedQuotesApi) => {
    return {
      onReady: (callback) => {
        setTimeout(
          () =>
            callback({
              supported_resolutions: [
                "1S",
                "10",
                "15",
                "30",
                "60",
                "240",
                "480",
                "720",
                "1440",
                "3D",
                "W",
                "M",
              ] as ResolutionString[],
              supports_marks: true,
              supports_timescale_marks: true,
              supports_time: true,
            }),
          0
        );
      },
      resolveSymbol: (symbolName, onSymbolResolvedCallback) => {
        setTimeout(() => {
          onSymbolResolvedCallback({
            name: symbolName,
            description: tokenDescription,
            exchange: tokenExchange,
            timezone: "Etc/UTC",
            minmov: 1,
            session: "24x7",
            has_intraday: true,
            type: "crypto",
            supported_resolutions: [
              "1S",
              "10",
              "15",
              "30",
              "60",
              "240",
              "480",
              "720",
              "1440",
              "3D",
              "W",
              "M",
            ] as ResolutionString[],
            pricescale: 100000000,
            ticker: symbolName,
            listed_exchange: "Listed exchange",
            format: "price",
          });
        }, 0);
      },
      getBars: (symbolInfo, resolution, periodParams, onResult, onError) => {
        setTimeout(async () => {
          let bars = [];
          const fetchData = async (
            timeframe: string,
            aggregate: number,
            sumbolInfo: {
              tokenAddress: string,
              network: string
            }
          ): Promise<IDatafeed> => {
            return await getDataFeed({
              params: {
                contractAddress: sumbolInfo.tokenAddress,
                network: sumbolInfo.network,
                timeframe,
                aggregate,
              },
            });
          };

          console.log(compareingData.current, symbolInfo.name)
          if (compareingData.current?.[symbolInfo.name]) {

            const defaultBars = compareingData.current[symbolInfo.name].bars;
            if (defaultBars) {
              bars = defaultBars;
            } else {
              const [network, contractAddress] =
                compareingData.current?.[symbolInfo.name]?.id?.split(
                  "_"
                ) ?? [];

              const minuteDatafeed = await fetchData("minute", 5, {
                tokenAddress: contractAddress,
                network: network,
              })

              const hourDatafeed = await fetchData("hour", 1, {
                tokenAddress: contractAddress,
                network: network,
              })

              const dayDatafeed = await fetchData("day", 1, {
                tokenAddress: contractAddress,
                network: network,
              })

              bars = mergeOhlcvData(
                getOhlcvData(minuteDatafeed!),
                getOhlcvData(hourDatafeed!),
                getOhlcvData(dayDatafeed!)
              )
            }

          } else {
            bars = ohlcvData;
          }

          const resolvationMap: any = {
            10: 600,
            15: 900,
            30: 1800,
            60: 3600,
            240: 14400,
            480: 28800,
            720: 43200,
            "1D": 86400,
            "3D": 259200,
            "1W": 604800,
            "1M": 2592e3
          };


          let n = resolvationMap[resolution] || 300
          const uniqueTimeDurationMap = new Map();
          for (const bar of bars) {
            let e = Math.floor(bar.time / n) * n;
            if (uniqueTimeDurationMap.has(e)) {
              let data = uniqueTimeDurationMap.get(e);
              data.high = Math.max(data.high, bar.high),
                data.low = Math.min(data.low, bar.low),
                data.close = bar.close,
                data.volume += bar.volume
            } else {
              uniqueTimeDurationMap.set(e, {
                time: e,
                open: bar.open,
                high: bar.high,
                low: bar.low,
                close: bar.close,
                volume: bar.volume
              })
            }
          };

          const finalData = Array.from(uniqueTimeDurationMap.values()).sort((e, t) => e.time - t.time).filter(
            (bar) =>
              bar.time * 1000 >= periodParams.from * 1000 &&
              bar.time * 1000 <= periodParams.to * 1000
          )
            .map((bar) => ({
              time: bar.time * 1000,
              open: bar.open,
              high: bar.high,
              low: bar.low,
              close: bar.close,
              volume: bar.volume,
            }));

          if (finalData.length) {
            onResult(finalData, { noData: false });
          } else {
            onResult([], { noData: true });
          }
        }, 50);
      },
      subscribeBars: (symbolInfo, resolution, onRealtimeCallback) => {
        intervalId = setInterval(() => {
          if (compareingData.current?.[symbolInfo.name]) {
            return;
          }
          const latestBar = {
            time: ohlcvData[ohlcvData.length - 1].time * 1000,
            open: ohlcvData[ohlcvData.length - 1].open,
            high: ohlcvData[ohlcvData.length - 1].high,
            low: ohlcvData[ohlcvData.length - 1].low,
            close: ohlcvData[ohlcvData.length - 1].close,
            volume: ohlcvData[ohlcvData.length - 1].volume,
          };

          if (latestBar) {
            onRealtimeCallback(latestBar);
          }
        }, 10000);
      },
      unsubscribeBars: () => {
        clearInterval(intervalId);
      },
      searchSymbols: (
        userInput,
        exchange,
        symbolType,
        onResultReadyCallback
      ) => {
        const defaultSymbols = [
          {
            symbol: "TURBO",
            full_name: "TURBO / USD",
            description: "Turbo",
          },
        ];

        const symbols = [...defaultSymbols, ...customSymbols];

        const filteredSymbols = symbols
          .filter((symbol) =>
            symbol.full_name.toLowerCase().includes(userInput.toLowerCase())
          )
          .map((symbol) => ({
            ...symbol,
            exchange: tokenExchange,
            type: "crypto",
          }));

        onResultReadyCallback(filteredSymbols);
      },
    };
  };

  useEffect(() => {
    const widgetOptions: ChartingLibraryWidgetOptions = {
      symbol: chartOptions.symbol || "DefaultSymbol",
      datafeed: dataFeed(ohlcvData, tokenDescription, tokenExchange),
      interval:
        (chartOptions.interval as ResolutionString) ||
        ("4H" as ResolutionString),
      container: chartContainerRef.current,
      library_path: chartOptions.library_path,
      locale: "en",
      debug: true,
      disabled_features: ["use_localstorage_for_settings", "header_compare"],
      enabled_features: ["study_templates"],
      charts_storage_url: chartOptions.charts_storage_url,
      charts_storage_api_version: chartOptions.charts_storage_api_version,
      client_id: chartOptions.client_id,
      user_id: chartOptions.user_id,
      fullscreen: chartOptions.fullscreen,
      autosize: chartOptions.autosize,
      timezone: "Etc/UTC",
      theme: theme || "dark",
      custom_formatters: {
        priceFormatterFactory: (symbolInfo) => {
          if (symbolInfo === null) {
            return null;
          }
          return {
            format: (price: number) => {
              if (Math.abs(price) < 0.00001) {
                const priceSplited = price.toExponential().split('e')
                let zeros = priceSplited[1]
                zeros = zeros.startsWith('-') ? zeros.slice(1) : zeros
                zeros = (Number(zeros) - 1).toString()
                const noUnderLines = '₀₁₂₃₄₅₆₇₈₉'
                const firstSlice = `0.0${zeros.split('').map(item => noUnderLines[Number(item)]).join('')}`
                let secondPart = priceSplited[0].replace(/\./g, '');
                secondPart = secondPart.length > 3 ? secondPart.slice(0, 3) : secondPart;
                secondPart = secondPart.startsWith('-') ? secondPart.slice(1) : secondPart
                return `${price < 0 ? '-' : ''}${firstSlice}${secondPart}`
              }
              return price.toLocaleString()
            },
          };
          return null;

        }
      }
    };

    myWidget.current = new TradingViewWidget(widgetOptions);

    return () => {
      myWidget.current.remove();
    };
  }, [pathname]);

  useEffect(() => {
    if (myWidget.current) {
      myWidget.current.onChartReady(() => {
        setChartIsReady(true);
      });
    }
  }, [myWidget]);

  useEffect(() => {
    if (chartIsReady) {
      if (myWidget.current) {
        myWidget.current.headerReady().then(() => {
          const compareButton = myWidget.current?.createButton()
          compareButton.textContent = 'Comapre';
          compareButton.addEventListener('click', () => {
            setIsCompareModalOpen(true)
          })
        })
      }
    }
  }, [chartIsReady])

  useEffect(() => {
    if (chartIsReady) myWidget.current.changeTheme(theme);
  }, [theme, chartIsReady]);

  useEffect(() => {
    if (chartIsReady) {
      myWidget.current._options.datafeed = dataFeed(
        ohlcvData,
        tokenDescription,
        tokenExchange
      );
      myWidget.current.activeChart().resetData();
    }
  }, [ohlcvData, tokenDescription, tokenExchange, chartIsReady]);

  const handleAddCompare = (data: Daum) => {
    if (myWidget.current && chartIsReady && data.id && data.attributes?.name) {
      console.log({ data })
      myWidget.current.activeChart().createStudy('Compare', false, false, {
        symbol: data.attributes?.name?.replace(/ \/ /g, ':')
      }, undefined, {
        priceScale: "new-left",
      })
      compareingData.current[data.attributes?.name?.replace(/ \/ /g, ':')] = data;
      setIsCompareModalOpen(false)
    }
  }

  return <Fragment>
    <Dialog open={isCompareModalOpen} modal onOpenChange={(value) => setIsCompareModalOpen(value)}>
      <LogoSelect onAdd={handleAddCompare} />
    </Dialog>
    <div ref={chartContainerRef} className={"TVChartContainer"} />;
  </Fragment>
};

export default MyTradingView;
