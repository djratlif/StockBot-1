import React, { useState, useEffect, useRef } from 'react';
import CountUp from 'react-countup';
import { Box, Typography, Fade } from '@mui/material';
import { ArrowUpward, ArrowDownward } from '@mui/icons-material';

interface AnimatedPriceProps {
  value: number;
  trendValue?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  typographyVariant?: any;
  typographySx?: any;
  color?: string;
}

const AnimatedPrice: React.FC<AnimatedPriceProps> = ({
  value,
  trendValue,
  prefix = '',
  suffix = '',
  decimals = 2,
  typographyVariant = 'h4',
  typographySx = {},
  color = '#ffffff'
}) => {
  const [prevTrendValue, setPrevTrendValue] = useState(trendValue !== undefined ? trendValue : value);
  const [showArrow, setShowArrow] = useState(false);
  const [direction, setDirection] = useState<'up' | 'down'>('up');
  const arrowTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const currentTrend = trendValue !== undefined ? trendValue : value;
    
    if (currentTrend !== prevTrendValue) {
      const isUp = currentTrend > prevTrendValue;
      setDirection(isUp ? 'up' : 'down');
      setShowArrow(true);
      
      if (arrowTimeoutRef.current) {
        clearTimeout(arrowTimeoutRef.current);
      }
      
      // Keep it visible for 2 seconds, then Fade out will take another 1s
      arrowTimeoutRef.current = setTimeout(() => {
        setShowArrow(false);
      }, 2000); 
      
      setPrevTrendValue(currentTrend);
    }
  }, [value, trendValue, prevTrendValue]);

  // Update prevValue immediately before next render if changed
  // so CountUp sees the old prevValue as 'start' and new value as 'end'.
  // Actually, CountUp handles start/end based on prop changes automatically
  // but we need to pass start/end properly. Wait, CountUp does:
  // <CountUp end={value} /> and automatically transitions from the previous `end` prop.
  // We can just pass `end={value}` and let it handle the flipping natively without 'start'.

  return (
    <Box display="flex" alignItems="center">
      <Typography variant={typographyVariant} sx={{ color, display: 'flex', alignItems: 'center', ...typographySx }}>
        {prefix}
        <CountUp
          end={value}
          duration={1.5}
          decimals={decimals}
          separator=","
          preserveValue={true}
        />
        {suffix}
      </Typography>
      
      <Fade in={showArrow} timeout={{ enter: 300, exit: 2000 }}>
        <Box display="flex" alignItems="center" ml={1}>
          {direction === 'up' ? (
            <ArrowUpward sx={{ color: '#4caf50', fontSize: '1.5rem' }} />
          ) : (
            <ArrowDownward sx={{ color: '#f44336', fontSize: '1.5rem' }} />
          )}
        </Box>
      </Fade>
    </Box>
  );
};

export default AnimatedPrice;
