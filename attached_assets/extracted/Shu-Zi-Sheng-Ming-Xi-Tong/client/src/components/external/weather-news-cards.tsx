import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cloud, Newspaper, RefreshCw, Thermometer, Droplets, Wind } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface WeatherData {
  location: { city: string; cityCode: string };
  current: {
    temperature: number;
    humidity: number;
    windSpeed: string;
    windDirection: string;
    description: string;
    icon: string;
    quality: string;
    pm25: number;
  };
  forecast: Array<{
    date: string;
    tempMax: number;
    tempMin: number;
    description: string;
    icon: string;
    week: string;
  }>;
  ganmao: string;
  updatedAt: string;
}

interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  source: string;
  category: string;
  publishedAt: string;
  url: string;
}

interface NewsData {
  articles: NewsArticle[];
  category: string;
  updatedAt: string;
}

export function WeatherCard() {
  const { data, isLoading, refetch, isRefetching, error } = useQuery<WeatherData>({
    queryKey: ["/api/external/weather"],
    refetchInterval: 600000,
    retry: 2,
  });

  if (isLoading) {
    return (
      <Card data-testid="card-weather-loading">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-mono text-muted-foreground flex items-center gap-2">
            <Cloud className="w-4 h-4" />
            天气信息
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-weather">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-mono text-muted-foreground flex items-center gap-2">
            <Cloud className="w-4 h-4" />
            {data?.location?.city || '上海'} · 实时天气
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => refetch()}
            disabled={isRefetching}
            data-testid="button-refresh-weather"
          >
            <RefreshCw className={`w-3 h-3 ${isRefetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="text-center text-muted-foreground py-4">
            <p>暂时无法获取天气数据</p>
            <Button variant="link" size="sm" onClick={() => refetch()}>
              点击重试
            </Button>
          </div>
        ) : data ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-4xl">{data.current.icon}</span>
                <div>
                  <div className="text-2xl font-light" data-testid="text-temperature">
                    {data.current.temperature}°C
                  </div>
                  <div className="text-sm text-muted-foreground" data-testid="text-weather-desc">
                    {data.current.description}
                  </div>
                </div>
              </div>
              <div className="text-right space-y-1 text-xs text-muted-foreground">
                <div className="flex items-center gap-1 justify-end">
                  <Droplets className="w-3 h-3" />
                  <span>湿度 {data.current.humidity}%</span>
                </div>
                <div className="flex items-center gap-1 justify-end">
                  <Wind className="w-3 h-3" />
                  <span>{data.current.windDirection} {data.current.windSpeed}</span>
                </div>
                <div className="flex items-center gap-1 justify-end">
                  <span className={data.current.quality === '优' ? 'text-green-500' : data.current.quality === '良' ? 'text-yellow-500' : 'text-orange-500'}>
                    空气{data.current.quality}
                  </span>
                </div>
              </div>
            </div>

            {data.ganmao && (
              <div className="text-xs text-muted-foreground bg-secondary/30 p-2 rounded">
                {data.ganmao}
              </div>
            )}

            <div className="grid grid-cols-5 gap-1 pt-2 border-t border-border">
              {data.forecast.slice(0, 5).map((day, i) => (
                <div key={i} className="text-center p-1" data-testid={`forecast-day-${i}`}>
                  <div className="text-xs text-muted-foreground">
                    {day.week?.replace('星期', '周') || ''}
                  </div>
                  <div className="text-lg">{day.icon}</div>
                  <div className="text-xs">
                    <span className="text-primary">{day.tempMax}°</span>
                    <span className="text-muted-foreground">/{day.tempMin}°</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-4">
            无法获取天气数据
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function NewsCard() {
  const { data, isLoading, refetch, isRefetching } = useQuery<NewsData>({
    queryKey: ["/api/external/news"],
    refetchInterval: 300000,
  });

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) return '刚刚';
    if (diffHours < 24) return `${diffHours}小时前`;
    return date.toLocaleDateString('zh-CN');
  };

  if (isLoading) {
    return (
      <Card data-testid="card-news-loading">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-mono text-muted-foreground flex items-center gap-2">
            <Newspaper className="w-4 h-4" />
            新闻资讯
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-news">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-mono text-muted-foreground flex items-center gap-2">
            <Newspaper className="w-4 h-4" />
            今日热点
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => refetch()}
            disabled={isRefetching}
            data-testid="button-refresh-news"
          >
            <RefreshCw className={`w-3 h-3 ${isRefetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {data?.articles ? (
          <div className="space-y-3">
            {data.articles.slice(0, 4).map((article) => (
              <div
                key={article.id}
                className="p-2 rounded-md hover:bg-secondary/50 transition-colors cursor-pointer border-l-2 border-primary/30 pl-3"
                data-testid={`news-article-${article.id}`}
              >
                <h4 className="text-sm font-medium line-clamp-1" data-testid={`news-title-${article.id}`}>
                  {article.title}
                </h4>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                  {article.summary}
                </p>
                <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground/70">
                  <span>{article.source}</span>
                  <span>{formatTime(article.publishedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-4">
            无法获取新闻数据
          </div>
        )}
      </CardContent>
    </Card>
  );
}
