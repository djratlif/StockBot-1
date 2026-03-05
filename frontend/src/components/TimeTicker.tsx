import React, { useState, useEffect } from 'react';
import { Box, Typography, Chip } from '@mui/material';
import { Schedule, TrendingUp, TrendingDown, AccessTime } from '@mui/icons-material';

export { };

const TimeTicker: React.FC = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [marketStatus, setMarketStatus] = useState<'OPEN' | 'CLOSED' | 'PRE_MARKET'>('CLOSED');

  const updateTime = () => {
    const now = new Date();
    setCurrentTime(now);

    // Check market status (EST)
    const estTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const day = estTime.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const hour = estTime.getHours();
    const minute = estTime.getMinutes();
    const timeInMinutes = hour * 60 + minute;

    const preMarketOpen = 4 * 60; // 4:00 AM
    const marketOpen = 9 * 60 + 30; // 9:30 AM
    const marketClose = 16 * 60; // 4:00 PM

    const isWeekday = day >= 1 && day <= 5; // Monday to Friday

    if (!isWeekday) {
      setMarketStatus('CLOSED');
      return;
    }

    if (timeInMinutes >= marketOpen && timeInMinutes < marketClose) {
      setMarketStatus('OPEN');
    } else if (timeInMinutes >= preMarketOpen && timeInMinutes < marketOpen) {
      setMarketStatus('PRE_MARKET');
    } else {
      setMarketStatus('CLOSED');
    }
  };

  const formatTimeEST = (date: Date) => {
    return date.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  const getNextMarketEvent = () => {
    const now = new Date();
    const estTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const day = estTime.getDay();
    const hour = estTime.getHours();
    const minute = estTime.getMinutes();
    const timeInMinutes = hour * 60 + minute;

    const preMarketOpen = 4 * 60; // 4:00 AM
    const marketOpen = 9 * 60 + 30; // 9:30 AM
    const marketClose = 16 * 60; // 4:00 PM

    if (day >= 1 && day <= 5) { // Weekday
      if (timeInMinutes < preMarketOpen) {
        const minutesUntilPre = preMarketOpen - timeInMinutes;
        const hours = Math.floor(minutesUntilPre / 60);
        const mins = minutesUntilPre % 60;
        return `Pre-market in ${hours}h ${mins}m`;
      } else if (timeInMinutes < marketOpen) {
        const minutesUntilOpen = marketOpen - timeInMinutes;
        const hours = Math.floor(minutesUntilOpen / 60);
        const mins = minutesUntilOpen % 60;
        return `Opens in ${hours}h ${mins}m`;
      } else if (timeInMinutes < marketClose) {
        const minutesUntilClose = marketClose - timeInMinutes;
        const hours = Math.floor(minutesUntilClose / 60);
        const mins = minutesUntilClose % 60;
        return `Closes in ${hours}h ${mins}m`;
      } else {
        return 'Pre-market tomorrow at 4:00 AM';
      }
    } else {
      // Weekend
      const daysUntilMonday = day === 0 ? 1 : 8 - day; // If Sunday (0), 1 day. If Saturday (6), 2 days.
      return `Pre-market ${daysUntilMonday === 1 ? 'tomorrow' : `in ${daysUntilMonday} days`} at 4:00 AM`;
    }
  };

  useEffect(() => {
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Box display="flex" alignItems="center" gap={2}>
      <Box display="flex" alignItems="center" gap={1}>
        <Schedule sx={{ color: 'inherit', fontSize: '1.1rem' }} />
        <Typography variant="body2" sx={{ color: 'inherit', fontWeight: 500 }}>
          {formatTimeEST(currentTime)} EST
        </Typography>
      </Box>

      <Box sx={{ height: '20px', width: '1px', backgroundColor: 'rgba(255,255,255,0.3)' }} />

      <Chip
        icon={marketStatus === 'OPEN' ? <TrendingUp /> : marketStatus === 'PRE_MARKET' ? <TrendingDown sx={{ transform: 'rotate(-45deg)' }} /> : <TrendingDown />}
        label={marketStatus === 'OPEN' ? 'Open' : marketStatus === 'PRE_MARKET' ? 'Pre-market' : 'Closed'}
        size="small"
        sx={{
          backgroundColor: marketStatus === 'OPEN' ? 'rgba(76, 175, 80, 0.2)' : marketStatus === 'PRE_MARKET' ? 'rgba(255, 152, 0, 0.2)' : 'rgba(255,255,255,0.1)',
          color: 'inherit',
          border: marketStatus === 'OPEN' ? '1px solid rgba(76, 175, 80, 0.5)' : marketStatus === 'PRE_MARKET' ? '1px solid rgba(255, 152, 0, 0.5)' : '1px solid rgba(255,255,255,0.3)',
          '& .MuiChip-icon': {
            color: marketStatus === 'OPEN' ? '#4caf50' : marketStatus === 'PRE_MARKET' ? '#ff9800' : 'inherit'
          }
        }}
      />

      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
        {getNextMarketEvent()}
      </Typography>
    </Box>
  );
};

export default TimeTicker;