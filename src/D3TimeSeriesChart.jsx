import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

const D3TimeSeriesChart = () => {
  const svgRef = useRef();
  const [data, setData] = useState(null);

  // Load CSV data using d3.csv.
  useEffect(() => {
    d3.csv('/data.csv', (d) => {
      return {
        city: d.City,
        year: +d.Year, // Convert year to a number
        costOfLiving: +d['Cost of Living'], // Convert to number
        crimeRate: +d['Crime Rate'], // Convert to number
      };
    })
      .then((loadedData) => {
        console.log('Loaded Data:', loadedData); // Log the loaded data

        // Group data by city
        const groupedData = d3.groups(loadedData, (d) => d.city);

        // Format data for the chart
        const formattedData = groupedData.map(([city, values]) => ({
          city,
          values: values.map((v) => ({
            date: new Date(v.year, 0, 1), // Convert year to a date
            costOfLiving: v.costOfLiving,
            crimeRate: v.crimeRate,
          })),
        }));

        console.log('Formatted Data:', formattedData); // Log the formatted data
        setData(formattedData);
      })
      .catch((error) => {
        console.error('Error loading CSV:', error);
      });
  }, []);

  // Render the chart using D3 when data is loaded.
  useEffect(() => {
    if (!data) return;

    // Set dimensions and margins.
    const margin = { top: 50, right: 60, bottom: 50, left: 60 };
    const width = 800 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    // Select the SVG and clear previous content.
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Append group element with margin transform.
    const g = svg
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Set scales.
    const xScale = d3
      .scaleTime()
      .domain([
        d3.min(data, (d) => d3.min(d.values, (v) => v.date)),
        d3.max(data, (d) => d3.max(d.values, (v) => v.date)),
      ])
      .range([0, width]);

    const yScale = d3
      .scaleLinear()
      .domain([
        0,
        d3.max(data, (d) => d3.max(d.values, (v) => v.costOfLiving)) * 1.1,
      ])
      .range([height, 0]);

    // Create a color scale for cities.
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

    // Create line generator.
    const line = d3
      .line()
      .x((d) => xScale(d.date))
      .y((d) => yScale(d.costOfLiving))
      .curve(d3.curveMonotoneX);

    // Draw gridlines.
    g.append('g')
      .attr('class', 'grid')
      .call(
        d3
          .axisLeft(yScale)
          .ticks(6)
          .tickSize(-width)
          .tickFormat('')
      )
      .selectAll('line')
      .attr('stroke', '#e0e0e0')
      .attr('stroke-dasharray', '3,3');

    // Append the line paths for each city.
    data.forEach((d) => {
      g.append('path')
        .datum(d.values)
        .attr('fill', 'none')
        .attr('stroke', colorScale(d.city))
        .attr('stroke-width', 2)
        .attr('d', line);
    });

    // Add axes.
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(6)
      .tickFormat(d3.timeFormat('%Y')); // Format as year only
    const yAxis = d3.axisLeft(yScale).ticks(6);

    g.append('g')
      .attr('transform', `translate(0, ${height})`)
      .call(xAxis)
      .selectAll('text')
      .attr('font-size', '12px');

    g.append('g')
      .call(yAxis)
      .selectAll('text')
      .attr('font-size', '12px');

    // Add a legend for cities.
    const legend = g
      .selectAll('.legend')
      .data(data)
      .enter()
      .append('g')
      .attr('class', 'legend')
      .attr('transform', (d, i) => `translate(0, ${i * 20})`);

    legend
      .append('rect')
      .attr('x', width - 100)
      .attr('width', 18)
      .attr('height', 18)
      .attr('fill', (d) => colorScale(d.city));

    legend
      .append('text')
      .attr('x', width - 80)
      .attr('y', 9)
      .attr('dy', '.35em')
      .style('text-anchor', 'start')
      .text((d) => d.city);
  }, [data]);

  return (
    <div>
      <h1>The Cost of Living Alongside Crime Rates</h1>
      {data ? (
        <svg
          ref={svgRef}
          style={{ border: '1px solid #ccc', background: '#fafafa', width: '800px', height: '400px' }}
        />
      ) : (
        <p>Loading data...</p>
      )}
    </div>
  );
};

export default D3TimeSeriesChart;