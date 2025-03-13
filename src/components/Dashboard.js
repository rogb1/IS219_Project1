import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import Papa from 'papaparse';

const Dashboard = () => {
  const svgRef = useRef();
  const tooltipRef = useRef();
  const [data, setData] = useState([]);
  const [selectedCities, setSelectedCities] = useState(["New York", "San Francisco", "Chicago"]);
  const [selectedMetrics, setSelectedMetrics] = useState(["costOfLiving", "crimeRate"]);
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth * 0.8,
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
              crimeRate: +row['Crime Rate'],
            }));
            console.log('Parsed Data:', parsedData); // Debug: Check parsed data
            setData(parsedData);
          },
        });
      });
  }, []);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        ...dimensions,
        width: window.innerWidth * 0.8,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [dimensions]);

  // Draw the chart
  useEffect(() => {
    if (!data.length || !svgRef.current) return;

    // Define cities inside the useEffect hook
    const cities = Array.from(new Set(data.map((d) => d.city)));

    // Filter data based on selected cities
    const filteredData = data.filter((d) => selectedCities.includes(d.city));

    // Clear previous chart
    d3.select(svgRef.current).selectAll('*').remove();

    // Rest of the chart code...
    const svg = d3.select(svgRef.current)
      .attr("width", dimensions.width)
      .attr("height", dimensions.height);

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

    const chartWidth = dimensions.width - dimensions.margin.left - dimensions.margin.right;
    const chartHeight = dimensions.height - dimensions.margin.top - dimensions.margin.bottom;

    const chart = svg.append("g")
      .attr("transform", `translate(${dimensions.margin.left}, ${dimensions.margin.top})`);

    const years = Array.from(new Set(data.map((d) => d.year))).sort((a, b) => a - b);
    const xScale = d3.scaleLinear()
      .domain([d3.min(years), d3.max(years)])
      .range([0, chartWidth]);

    const yScales = {
      costOfLiving: d3.scaleLinear()
        .domain([0, d3.max(filteredData, (d) => d.costOfLiving) * 1.1])
        .range([chartHeight, 0]),
      crimeRate: d3.scaleLinear()
        .domain([0, d3.max(filteredData, (d) => d.crimeRate) * 1.1])
        .range([chartHeight, 0]),
    };

    const lineGenerators = {
      costOfLiving: d3.line()
        .x((d) => xScale(d.year))
        .y((d) => yScales.costOfLiving(d.costOfLiving))
        .curve(d3.curveMonotoneX),
      crimeRate: d3.line()
        .x((d) => xScale(d.year))
        .y((d) => yScales.crimeRate(d.crimeRate))
        .curve(d3.curveMonotoneX),
    };

    const colorScale = d3.scaleOrdinal()
      .domain(cities)
      .range(["#4e79a7", "#f28e2c", "#e15759", "#76b7b2", "#59a14f", "#edc949"]);

    const metricStyles = {
      costOfLiving: { strokeWidth: 2, strokeDasharray: "none" },
      crimeRate: { strokeWidth: 2, strokeDasharray: "5,5" },
    };

    // Draw X axis
    chart.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0, ${chartHeight})`)
      .call(d3.axisBottom(xScale).tickFormat((d) => d.toString()).ticks(years.length > 10 ? 10 : years.length));

    // Draw Y axes
    if (selectedMetrics.includes("costOfLiving")) {
      chart.append("g")
        .attr("class", "y-axis-cost")
        .call(d3.axisLeft(yScales.costOfLiving));

      chart.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -60)
        .attr("x", -chartHeight / 2)
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .style("fill", "#4e79a7")
        .style("font-weight", "bold")
        .text("Cost of Living Index");
    }

    if (selectedMetrics.includes("crimeRate")) {
      chart.append("g")
        .attr("class", "y-axis-crime")
        .attr("transform", `translate(${chartWidth}, 0)`)
        .call(d3.axisRight(yScales.crimeRate));

      chart.append("text")
        .attr("transform", "rotate(90)")
        .attr("y", -chartWidth - 60)
        .attr("x", chartHeight / 2)
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .style("fill", "#e15759")
        .style("font-weight", "bold")
        .text("Crime Rate Index");
    }

    // Title
    svg.append("text")
      .attr("x", dimensions.width / 2)
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .style("font-size", "18px")
      .style("font-weight", "bold")
      .text("City Cost of Living and Crime Rate (2005-2025)");

    // Draw lines for each city and metric
    selectedCities.forEach((city) => {
      const cityData = filteredData.filter((d) => d.city === city);

      selectedMetrics.forEach((metric) => {
        chart.append("path")
          .datum(cityData)
          .attr("fill", "none")
          .attr("stroke", metric === "costOfLiving" ? colorScale(city) : d3.color(colorScale(city)).darker())
          .attr("stroke-width", metricStyles[metric].strokeWidth)
          .attr("stroke-dasharray", metricStyles[metric].strokeDasharray)
          .attr("d", lineGenerators[metric]);

        chart.selectAll(`.dot-${city}-${metric}`)
          .data(cityData)
          .enter().append("circle")
          .attr("class", `dot-${city}-${metric}`)
          .attr("cx", (d) => xScale(d.year))
          .attr("cy", (d) => yScales[metric](d[metric]))
          .attr("r", 4)
          .attr("fill", metric === "costOfLiving" ? colorScale(city) : d3.color(colorScale(city)).darker())
          .on("mouseover", function (event, d) {
            d3.select(this)
              .attr("r", 6)
              .attr("stroke", "#000")
              .attr("stroke-width", 2);

            tooltip
              .style("visibility", "visible")
              .html(`
                <div>
                  <strong>${city}</strong> (${d.year})<br/>
                  Cost of Living: ${d.costOfLiving}<br/>
                  Crime Rate: ${d.crimeRate}
                </div>
              `);
          })
          .on("mousemove", function (event) {
            tooltip
              .style("top", `${event.pageY - 10}px`)
              .style("left", `${event.pageX + 10}px`);
          })
          .on("mouseout", function () {
            d3.select(this)
              .attr("r", 4)
              .attr("stroke", "none");

            tooltip
              .style("visibility", "hidden");
          });
      });
    });

    // Create legend
    const legend = svg.append("g")
      .attr("class", "legend")
      .attr("transform", `translate(${dimensions.width - dimensions.margin.right + 20}, ${dimensions.margin.top})`);

    // City legend
    selectedCities.forEach((city, i) => {
      const group = legend.append("g")
        .attr("transform", `translate(0, ${i * 40})`);

      group.append("rect")
        .attr("width", 15)
        .attr("height", 15)
        .attr("fill", colorScale(city));

      group.append("text")
        .attr("x", 25)
        .attr("y", 12)
        .text(city);
    });

    // Metric legend
    const metricLegend = legend.append("g")
      .attr("transform", `translate(0, ${selectedCities.length * 40 + 20})`);

    if (selectedMetrics.includes("costOfLiving")) {
      const group = metricLegend.append("g");

      group.append("line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", 15)
        .attr("y2", 0)
        .attr("stroke", "#4e79a7")
        .attr("stroke-width", 2);

      group.append("text")
        .attr("x", 25)
        .attr("y", 5)
        .text("Cost of Living");
    }

    if (selectedMetrics.includes("crimeRate")) {
      const group = metricLegend.append("g")
        .attr("transform", `translate(0, 20)`);

      group.append("line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", 15)
        .attr("y2", 0)
        .attr("stroke", "#e15759")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "5,5");

      group.append("text")
        .attr("x", 25)
        .attr("y", 5)
        .text("Crime Rate");
    }
  }, [data, selectedCities, selectedMetrics, dimensions]);

  // Toggle city selection
  const toggleCity = (city) => {
    if (selectedCities.includes(city)) {
      if (selectedCities.length > 1) {
        setSelectedCities(selectedCities.filter((c) => c !== city));
      }
    } else {
      setSelectedCities([...selectedCities, city]);
    }
  };

  // Toggle metric selection
  const toggleMetric = (metric) => {
    if (selectedMetrics.includes(metric)) {
      if (selectedMetrics.length > 1) {
        setSelectedMetrics(selectedMetrics.filter((m) => m !== metric));
      }
    } else {
      setSelectedMetrics([...selectedMetrics, metric]);
    }
  };

  return (
    <div className="flex flex-col items-center p-4 bg-gray-50 min-h-screen">
      <div className="w-full max-w-6xl bg-white rounded-lg shadow-lg p-6 mb-8">
        <h1 className="text-2xl font-bold mb-6 text-center">City Comparison Dashboard</h1>

        <div className="flex flex-wrap justify-between mb-6">
          <div className="w-full md:w-1/2 mb-4 md:mb-0">
            <h2 className="text-lg font-semibold mb-2">Select Cities:</h2>
            <div className="flex flex-wrap gap-2">
              {Array.from(new Set(data.map((d) => d.city))).map((city) => (
                <button
                  key={city}
                  onClick={() => toggleCity(city)}
                  className={`px-3 py-1 rounded-full text-sm ${
                    selectedCities.includes(city)
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {city}
                </button>
              ))}
            </div>
          </div>

          <div className="w-full md:w-1/2">
            <h2 className="text-lg font-semibold mb-2">Select Metrics:</h2>
            <div className="flex gap-4">
              <button
                onClick={() => toggleMetric("costOfLiving")}
                className={`px-3 py-1 rounded-full text-sm ${
                  selectedMetrics.includes("costOfLiving")
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                Cost of Living
              </button>
              <button
                onClick={() => toggleMetric("crimeRate")}
                className={`px-3 py-1 rounded-full text-sm ${
                  selectedMetrics.includes("crimeRate")
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                Crime Rate
              </button>
            </div>
          </div>
        </div>

        <div className="relative w-full h-full">
          <svg ref={svgRef}></svg>
          <div ref={tooltipRef}></div>
        </div>

        <div className="mt-6 text-sm text-gray-600">
          <p>Note: Cost of Living is indexed where 100 = national average in 2013. Crime Rate is an index where higher values indicate higher crime rates.</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;