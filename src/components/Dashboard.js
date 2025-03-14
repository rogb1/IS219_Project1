import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import Papa from 'papaparse';

const Dashboard = () => {
  const svgRef = useRef();
  const containerRef = useRef();
  const tooltipRef = useRef();
  const [data, setData] = useState([]);
  const [selectedCities, setSelectedCities] = useState(["New York City", "Houston"]);
  const [selectedMetrics, setSelectedMetrics] = useState(["costOfLiving", "violentCrimeRate"]);
  const [dimensions, setDimensions] = useState({
    width: 0,
    height: 500,
    margin: { top: 50, right: 150, bottom: 50, left: 80 },
  });

  // Fetch and parse data.csv
  useEffect(() => {
    fetch('/data.csv')
      .then((response) => response.text())
      .then((csvText) => {
        Papa.parse(csvText, {
          header: true,
          dynamicTyping: true,
          complete: (results) => {
            const parsedData = results.data.map((row) => ({
              city: row.City,
              year: +row.Year,
              costOfLiving: +row['Cost of Living'],
              violentCrimeRate: +row['Violent Crime Rate'],
            }));
            console.log('Parsed Data:', parsedData);
            setData(parsedData);
          },
        });
      });
  }, []);

  // Set initial dimensions based on container size
  useEffect(() => {
    if (containerRef.current) {
      const currentContainerRef = containerRef.current;
      
      const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
          setDimensions(prevDimensions => ({
            ...prevDimensions,
            width: entry.contentRect.width,
          }));
        }
      });
      
      resizeObserver.observe(currentContainerRef);
      
      // Set initial width
      setDimensions(prevDimensions => ({
        ...prevDimensions,
        width: currentContainerRef.clientWidth,
      }));
      
      return () => {
        resizeObserver.unobserve(currentContainerRef);
      };
    }
  }, []);

  // Toggle city selection without animation effect
  const toggleCity = React.useCallback((city) => {
    if (selectedCities.includes(city)) {
      if (selectedCities.length > 1) {
        setSelectedCities(selectedCities.filter((c) => c !== city));
      }
    } else {
      setSelectedCities([...selectedCities, city]);
    }
  }, [selectedCities]);

  // Toggle metric selection without animation effect
  const toggleMetric = React.useCallback((metric) => {
    if (selectedMetrics.includes(metric)) {
      if (selectedMetrics.length > 1) {
        setSelectedMetrics(selectedMetrics.filter((m) => m !== metric));
      }
    } else {
      setSelectedMetrics([...selectedMetrics, metric]);
    }
  }, [selectedMetrics]);

  // Draw the chart
  useEffect(() => {
    if (!data.length || !svgRef.current || dimensions.width === 0) return;

    // Define cities inside the useEffect hook
    const cities = Array.from(new Set(data.map((d) => d.city)));

    // Filter data based on selected cities
    const filteredData = data.filter((d) => selectedCities.includes(d.city));

    // Clear previous chart
    d3.select(svgRef.current).selectAll('*').remove();

    const chartWidth = dimensions.width - dimensions.margin.left - dimensions.margin.right;
    const chartHeight = dimensions.height - dimensions.margin.top - dimensions.margin.bottom;

    // Create SVG with proper dimensions
    const svg = d3.select(svgRef.current)
      .attr("width", dimensions.width)
      .attr("height", dimensions.height)
      .attr("viewBox", `0 0 ${dimensions.width} ${dimensions.height}`)
      .attr("preserveAspectRatio", "xMidYMid meet");

    const tooltip = d3.select(tooltipRef.current)
      .style("position", "absolute")
      .style("visibility", "hidden")
      .style("background-color", "white")
      .style("border", "1px solid #ddd")
      .style("border-radius", "5px")
      .style("padding", "10px")
      .style("box-shadow", "0 0 10px rgba(0,0,0,0.1)")
      .style("pointer-events", "none")
      .style("z-index", "10");

    const chart = svg.append("g")
      .attr("transform", `translate(${dimensions.margin.left}, ${dimensions.margin.top})`);

    // Add a rectangle for clipping content
    chart.append("rect")
      .attr("width", chartWidth)
      .attr("height", chartHeight)
      .attr("fill", "none")
      .attr("pointer-events", "all");

    const years = Array.from(new Set(data.map((d) => d.year))).sort((a, b) => a - b);
    const xScale = d3.scaleLinear()
      .domain([d3.min(years), d3.max(years)])
      .range([0, chartWidth]);

    // Add padding to y-scales to avoid dots at top/bottom edges
    const yScales = {
      costOfLiving: d3.scaleLinear()
        .domain([
          Math.max(0, d3.min(filteredData, (d) => d.costOfLiving) * 0.9),
          d3.max(filteredData, (d) => d.costOfLiving) * 1.1
        ])
        .range([chartHeight, 0]),
      violentCrimeRate: d3.scaleLinear()
        .domain([
          Math.max(0, d3.min(filteredData, (d) => d.violentCrimeRate) * 0.9),
          d3.max(filteredData, (d) => d.violentCrimeRate) * 1.1
        ])
        .range([chartHeight, 0]),
    };

    const lineGenerators = {
      costOfLiving: d3.line()
        .x((d) => xScale(d.year))
        .y((d) => yScales.costOfLiving(d.costOfLiving))
        .curve(d3.curveMonotoneX),
      violentCrimeRate: d3.line()
        .x((d) => xScale(d.year))
        .y((d) => yScales.violentCrimeRate(d.violentCrimeRate))
        .curve(d3.curveMonotoneX),
    };

    // Create a more vibrant color palette
    const colorScale = d3.scaleOrdinal()
      .domain(cities)
      .range(["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b"]);

    const metricStyles = {
      costOfLiving: { strokeWidth: 3, strokeDasharray: "none", color: "#4e79a7" },
      violentCrimeRate: { strokeWidth: 3, strokeDasharray: "5,5", color: "#e15759" },
    };

    // Add grid lines for better readability
    chart.append("g")
      .attr("class", "grid-lines")
      .selectAll("line")
      .data(xScale.ticks(years.length > 10 ? 10 : years.length))
      .enter()
      .append("line")
      .attr("x1", d => xScale(d))
      .attr("x2", d => xScale(d))
      .attr("y1", 0)
      .attr("y2", chartHeight)
      .attr("stroke", "#e0e0e0")
      .attr("stroke-width", 1);

    chart.append("g")
      .attr("class", "grid-lines")
      .selectAll("line")
      .data(yScales.costOfLiving.ticks(5))
      .enter()
      .append("line")
      .attr("x1", 0)
      .attr("x2", chartWidth)
      .attr("y1", d => yScales.costOfLiving(d))
      .attr("y2", d => yScales.costOfLiving(d))
      .attr("stroke", "#e0e0e0")
      .attr("stroke-width", 1);

    // Draw X axis
    chart.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0, ${chartHeight})`)
      .call(d3.axisBottom(xScale)
        .tickFormat((d) => d.toString())
        .ticks(years.length > 10 ? 10 : years.length))
      .selectAll("text")
      .style("font-size", "12px");

    chart.append("text")
      .attr("class", "x-axis-label")
      .attr("text-anchor", "middle")
      .attr("x", chartWidth / 2)
      .attr("y", chartHeight + 40)
      .style("font-size", "14px")
      .text("Year");

    // Draw Y axes
    if (selectedMetrics.includes("costOfLiving")) {
      chart.append("g")
        .attr("class", "y-axis-cost")
        .call(d3.axisLeft(yScales.costOfLiving)
          .ticks(5)
          .tickFormat(d => d))
        .selectAll("text")
        .style("font-size", "12px")
        .style("fill", metricStyles.costOfLiving.color);

      chart.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -60)
        .attr("x", -chartHeight / 2)
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .style("fill", metricStyles.costOfLiving.color)
        .style("font-weight", "bold")
        .style("font-size", "14px")
        .text("Cost of Living Index");
    }

    if (selectedMetrics.includes("violentCrimeRate")) {
      chart.append("g")
        .attr("class", "y-axis-violent")
        .attr("transform", `translate(${chartWidth}, 0)`)
        .call(d3.axisRight(yScales.violentCrimeRate)
          .ticks(5)
          .tickFormat(d => d))
        .selectAll("text")
        .style("font-size", "12px")
        .style("fill", metricStyles.violentCrimeRate.color);

      chart.append("text")
        .attr("transform", "rotate(90)")
        .attr("y", -chartWidth - 60)
        .attr("x", chartHeight / 2)
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .style("fill", metricStyles.violentCrimeRate.color)
        .style("font-weight", "bold")
        .style("font-size", "14px")
        .text("Violent Crime Rate");
    }

    // Title
    svg.append("text")
      .attr("x", dimensions.width / 2)
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .style("font-size", "18px")
      .style("font-weight", "bold")
      .text("City Cost of Living and Violent Crime Rate (2014-2024)");

    // Create highlight groups for each city
    selectedCities.forEach((city) => {
      const cityData = filteredData.filter((d) => d.city === city);
      const cityGroup = chart.append("g")
        .attr("class", `city-${city.replace(/ /g, '_').replace(/-/g, '_')}`);

      selectedMetrics.forEach((metric) => {
        // Add line without animation
        cityGroup.append("path")
          .datum(cityData)
          .attr("fill", "none")
          .attr("stroke", metric === "costOfLiving" ? colorScale(city) : d3.color(colorScale(city)).darker())
          .attr("stroke-width", metricStyles[metric].strokeWidth)
          .attr("stroke-dasharray", metricStyles[metric].strokeDasharray)
          .attr("opacity", 0.8)
          .attr("d", lineGenerators[metric]);

        // Replace spaces and hyphens with underscores in the city name
        const cityClass = city.replace(/ /g, '_').replace(/-/g, '_');
        
        // Add dots without animation
        cityGroup.selectAll(`.dot-${cityClass}-${metric}`)
          .data(cityData)
          .enter()
          .append("circle")
          .attr("class", `dot-${cityClass}-${metric}`)
          .attr("cx", (d) => xScale(d.year))
          .attr("cy", (d) => yScales[metric](d[metric]))
          .attr("r", 6) // Set radius directly without animation
          .attr("fill", metric === "costOfLiving" ? colorScale(city) : d3.color(colorScale(city)).darker())
          .attr("stroke", "#fff")
          .attr("stroke-width", 1.5)
          .style("cursor", "pointer")
          .on("mouseover", function (event, d) {
            // Highlight the dot without animation
            d3.select(this)
              .attr("r", 9)
              .attr("stroke", "#000")
              .attr("stroke-width", 2);
            
            // Show tooltip without animation
            tooltip
              .style("visibility", "visible")
              .style("opacity", 0.9)
              .html(`
                <div style="font-family: sans-serif;">
                  <div style="font-weight: bold; font-size: 14px; color: ${colorScale(city)}; margin-bottom: 5px;">
                    ${city} (${d.year})
                  </div>
                  <div style="margin: 5px 0; color: ${metricStyles.costOfLiving.color};">
                    <span style="font-weight: bold;">Cost of Living:</span> ${d.costOfLiving.toFixed(1)}
                  </div>
                  <div style="margin: 5px 0; color: ${metricStyles.violentCrimeRate.color};">
                    <span style="font-weight: bold;">Violent Crime Rate:</span> ${d.violentCrimeRate.toFixed(1)}
                  </div>
                </div>
              `);
          })
          .on("mousemove", function (event) {
            // Position tooltip to follow cursor
            tooltip
              .style("top", `${event.pageY - 10}px`)
              .style("left", `${event.pageX + 10}px`);
          })
          .on("mouseout", function () {
            // Reset dot styling without animation
            d3.select(this)
              .attr("r", 6)
              .attr("stroke", "#fff")
              .attr("stroke-width", 1.5);
            
            // Hide tooltip without animation
            tooltip
              .style("opacity", 0)
              .style("visibility", "hidden");
          });
      });
    });

    // Create an improved legend without animations
    const legend = svg.append("g")
      .attr("class", "legend")
      .attr("transform", `translate(${dimensions.width - dimensions.margin.right + 20}, ${dimensions.margin.top})`);

    // Add legend title
    legend.append("text")
      .attr("x", 0)
      .attr("y", -20)
      .style("font-size", "14px")
      .style("font-weight", "bold")
      .text("Legend");

    // City legend with improved styling but no animations
    selectedCities.forEach((city, i) => {
      const group = legend.append("g")
        .attr("transform", `translate(0, ${i * 30})`)
        .style("cursor", "pointer")
        .on("click", () => toggleCity(city));

      // Add background for better visibility without animation
      group.append("rect")
        .attr("x", -5)
        .attr("y", -15)
        .attr("width", 120)
        .attr("height", 25)
        .attr("rx", 5)
        .attr("ry", 5)
        .attr("fill", "#f8f8f8")
        .attr("stroke", "#ddd")
        .attr("stroke-width", 1)
        .style("opacity", 0)
        .on("mouseover", function() {
          d3.select(this).style("opacity", 1);
        })
        .on("mouseout", function() {
          d3.select(this).style("opacity", 0);
        });

      group.append("rect")
        .attr("width", 15)
        .attr("height", 15)
        .attr("rx", 2)
        .attr("ry", 2)
        .attr("fill", colorScale(city));

      group.append("text")
        .attr("x", 25)
        .attr("y", 12)
        .style("font-size", "13px")
        .text(city);
    });

    // Metric legend with better styling but no animations
    const metricLegend = legend.append("g")
      .attr("transform", `translate(0, ${selectedCities.length * 30 + 20})`);

    metricLegend.append("text")
      .attr("x", 0)
      .attr("y", -10)
      .style("font-size", "13px")
      .style("font-weight", "bold")
      .text("Metrics");

    if (selectedMetrics.includes("costOfLiving")) {
      const group = metricLegend.append("g")
        .attr("transform", `translate(0, 10)`)
        .style("cursor", "pointer")
        .on("click", () => toggleMetric("costOfLiving"));

      // Add background for better visibility without animation
      group.append("rect")
        .attr("x", -5)
        .attr("y", -15)
        .attr("width", 120)
        .attr("height", 25)
        .attr("rx", 5)
        .attr("ry", 5)
        .attr("fill", "#f8f8f8")
        .attr("stroke", "#ddd")
        .attr("stroke-width", 1)
        .style("opacity", 0)
        .on("mouseover", function() {
          d3.select(this).style("opacity", 1);
        })
        .on("mouseout", function() {
          d3.select(this).style("opacity", 0);
        });

      group.append("line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", 15)
        .attr("y2", 0)
        .attr("stroke", metricStyles.costOfLiving.color)
        .attr("stroke-width", 3);

      group.append("text")
        .attr("x", 25)
        .attr("y", 5)
        .style("font-size", "13px")
        .text("Cost of Living");
    }

    if (selectedMetrics.includes("violentCrimeRate")) {
      const group = metricLegend.append("g")
        .attr("transform", `translate(0, 40)`)
        .style("cursor", "pointer")
        .on("click", () => toggleMetric("violentCrimeRate"));

      // Add background for better visibility without animation
      group.append("rect")
        .attr("x", -5)
        .attr("y", -15)
        .attr("width", 120)
        .attr("height", 25)
        .attr("rx", 5)
        .attr("ry", 5)
        .attr("fill", "#f8f8f8")
        .attr("stroke", "#ddd")
        .attr("stroke-width", 1)
        .style("opacity", 0)
        .on("mouseover", function() {
          d3.select(this).style("opacity", 1);
        })
        .on("mouseout", function() {
          d3.select(this).style("opacity", 0);
        });

      group.append("line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", 15)
        .attr("y2", 0)
        .attr("stroke", metricStyles.violentCrimeRate.color)
        .attr("stroke-width", 3)
        .attr("stroke-dasharray", "5,5");

      group.append("text")
        .attr("x", 25)
        .attr("y", 5)
        .style("font-size", "13px")
        .text("Violent Crime Rate");
    }
  }, [data, selectedCities, selectedMetrics, dimensions, toggleCity, toggleMetric]);

  return (
    <div className="flex flex-col items-center p-4 bg-gray-50 min-h-screen">
      <div ref={containerRef} className="w-full max-w-6xl bg-white rounded-lg shadow-lg p-6 mb-8">
        <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">Cost of Living & Crime Rates</h1>

        <div className="flex flex-wrap justify-between mb-6">
          <div className="w-full md:w-1/2 mb-4 md:mb-0">
            <h2 className="text-lg font-semibold mb-2 text-gray-700">Cities</h2>
            <div className="flex flex-wrap gap-2">
              {Array.from(new Set(data.map((d) => d.city))).map((city) => (
                <button
                  key={city}
                  onClick={() => toggleCity(city)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    selectedCities.includes(city)
                      ? 'bg-blue-500 text-white shadow-md'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {city}
                </button>
              ))}
            </div>
          </div>

          <div className="w-full md:w-1/2">
            <h2 className="text-lg font-semibold mb-2 text-gray-700">Metrics</h2>
            <div className="flex gap-4">
              <button
                onClick={() => toggleMetric("costOfLiving")}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  selectedMetrics.includes("costOfLiving")
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Cost of Living
              </button>
              <button
                onClick={() => toggleMetric("violentCrimeRate")}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  selectedMetrics.includes("violentCrimeRate")
                    ? 'bg-red-500 text-white shadow-md'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Violent Crime Rate
              </button>
            </div>
          </div>
        </div>

        <div className="relative w-full overflow-hidden rounded-lg border border-gray-200 shadow-inner bg-gray-50 p-2">
          <svg ref={svgRef} className="w-full" style={{ minHeight: "500px" }}></svg>
          <div ref={tooltipRef}></div>
        </div>

        <div className="mt-6 text-sm text-gray-600 bg-gray-50 p-4 rounded-lg border border-gray-200">
          <p>
            <span className="font-semibold">Note:</span> Violent Crime Rate is per 100,000 population.
            <br />
            <span className="text-blue-600 text-xs mt-1 block">
                NYC is the reference city staying at 100. While every other city fluctuates to show the difference in cost of living compared to NYC.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;