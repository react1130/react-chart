/**
 * @fileOverview Area
 */
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import Animate from 'react-smooth';
import _ from 'lodash';
import Curve from '../shape/Curve';
import Dot from '../shape/Dot';
import Layer from '../container/Layer';
import LabelList from '../component/LabelList';
import pureRender from '../util/PureRender';
import { PRESENTATION_ATTRIBUTES, EVENT_ATTRIBUTES, LEGEND_TYPES,
  getPresentationAttributes, isSsr } from '../util/ReactUtils';
import { isNumber, uniqueId, getValueByDataKey,
  getCateCoordinateOfLine } from '../util/DataUtils';

@pureRender
class Area extends Component {

  static displayName = 'Area';

  static propTypes = {
    ...PRESENTATION_ATTRIBUTES,
    ...EVENT_ATTRIBUTES,
    className: PropTypes.string,
    dataKey: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.func]).isRequired,
    type: PropTypes.oneOfType([PropTypes.oneOf([
      'basis', 'basisClosed', 'basisOpen', 'linear', 'linearClosed', 'natural',
      'monotoneX', 'monotoneY', 'monotone', 'step', 'stepBefore', 'stepAfter',
    ]), PropTypes.func]),
    unit: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    name: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    yAxisId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    xAxisId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    yAxis: PropTypes.object,
    xAxis: PropTypes.object,
    stackId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    legendType: PropTypes.oneOf(LEGEND_TYPES),
    connectNulls: PropTypes.bool,

    activeDot: PropTypes.oneOfType([
      PropTypes.object, PropTypes.element, PropTypes.func, PropTypes.bool,
    ]),
    // dot configuration
    dot: PropTypes.oneOfType([
      PropTypes.func, PropTypes.element, PropTypes.object, PropTypes.bool,
    ]),
    label: PropTypes.oneOfType([
      PropTypes.func, PropTypes.element, PropTypes.object, PropTypes.bool,
    ]),
    hide: PropTypes.bool,
    // have curve configuration
    layout: PropTypes.oneOf(['horizontal', 'vertical']),
    baseLine: PropTypes.oneOfType([
      PropTypes.number, PropTypes.array,
    ]),
    isRange: PropTypes.bool,
    points: PropTypes.arrayOf(PropTypes.shape({
      x: PropTypes.number,
      y: PropTypes.number,
      value: PropTypes.oneOfType([PropTypes.number, PropTypes.array]),
    })),
    onAnimationStart: PropTypes.func,
    onAnimationEnd: PropTypes.func,

    animationId: PropTypes.number,
    isAnimationActive: PropTypes.bool,
    animationBegin: PropTypes.number,
    animationDuration: PropTypes.number,
    animationEasing: PropTypes.oneOf(['ease', 'ease-in', 'ease-out', 'ease-in-out', 'linear']),
  };

  static defaultProps = {
    stroke: '#3182bd',
    fill: '#3182bd',
    fillOpacity: 0.6,
    xAxisId: 0,
    yAxisId: 0,
    legendType: 'line',
    connectNulls: false,
    // points of area
    points: [],
    dot: false,
    activeDot: true,
    hide: false,

    isAnimationActive: !isSsr(),
    animationBegin: 0,
    animationDuration: 1500,
    animationEasing: 'ease',

    onAnimationStart: () => {},
    onAnimationEnd: () => {},
  };

  static getBaseValue = (props, xAxis, yAxis) => {
    const { layout, baseValue } = props;

    if (isNumber(baseValue)) { return baseValue; }

    const numericAxis = layout === 'horizontal' ? yAxis : xAxis;
    const domain = numericAxis.scale.domain();

    if (numericAxis.type === 'number') {
      const max = Math.max(domain[0], domain[1]);
      const min = Math.min(domain[0], domain[1]);

      if (baseValue === 'dataMin') { return min; }
      if (baseValue === 'dataMax') { return max; }

      return max < 0 ? max : Math.max(Math.min(domain[0], domain[1]), 0);
    }

    if (baseValue === 'dataMin') { return domain[0]; }
    if (baseValue === 'dataMax') { return domain[1]; }

    return domain[0];
  };

  static getComposedData = ({ props, xAxis, yAxis, xAxisTicks, yAxisTicks, bandSize,
    dataKey, stackedData, dataStartIndex, displayedData }) => {
    const { layout } = props;
    const hasStack = stackedData && stackedData.length;
    const baseValue = Area.getBaseValue(props, xAxis, yAxis);
    let isRange = false;

    const points = displayedData.map((entry, index) => {
      let value;

      if (hasStack) {
        value = stackedData[dataStartIndex + index];
      } else {
        value = getValueByDataKey(entry, dataKey);

        if (!_.isArray(value)) {
          value = [baseValue, value];
        } else {
          isRange = true;
        }
      }

      if (layout === 'horizontal') {
        return {
          x: getCateCoordinateOfLine({ axis: xAxis, ticks: xAxisTicks, bandSize, entry, index }),
          y: _.isNil(value[1]) ? null : yAxis.scale(value[1]),
          value,
          payload: entry,
        };
      }

      return {
        x: _.isNil(value[1]) ? null : xAxis.scale(value[1]),
        y: getCateCoordinateOfLine({ axis: yAxis, ticks: yAxisTicks, bandSize, entry, index }),
        value,
        payload: entry,
      };
    });

    let baseLine;
    if (hasStack || isRange) {
      baseLine = points.map(entry => ({
        x: layout === 'horizontal' ? entry.x : xAxis.scale(entry && entry.value[0]),
        y: layout === 'horizontal' ? yAxis.scale(entry && entry.value[0]) : entry.y,
      }));
    } else if (layout === 'horizontal') {
      baseLine = yAxis.scale(baseValue);
    } else {
      baseLine = xAxis.scale(baseValue);
    }

    return { points, baseLine, layout, isRange };
  };

  static renderDotItem = (option, props) => {
    let dotItem;

    if (React.isValidElement(option)) {
      dotItem = React.cloneElement(option, props);
    } else if (_.isFunction(option)) {
      dotItem = option(props);
    } else {
      dotItem = <Dot {...props} className="recharts-area-dot" />;
    }

    return dotItem;
  };

  state = { isAnimationFinished: true };

  id = uniqueId('recharts-area-');

  handleAnimationEnd = () => {
    this.setState({ isAnimationFinished: true });
    this.props.onAnimationEnd();
  };

  handleAnimationStart = () => {
    this.setState({ isAnimationFinished: false });
    this.props.onAnimationStart();
  };

  renderCurve() {
    const { layout, type, stroke, points, baseLine, connectNulls, isRange } = this.props;

    return (
      <g>
        {stroke !== 'none' && (
          <Curve
            {...getPresentationAttributes(this.props)}
            className="recharts-area-curve"
            layout={layout}
            type={type}
            connectNulls={connectNulls}
            fill="none"
            points={points}
          />
        )}
        {stroke !== 'none' && isRange && (
          <Curve
            {...getPresentationAttributes(this.props)}
            className="recharts-area-curve"
            layout={layout}
            type={type}
            connectNulls={connectNulls}
            fill="none"
            points={baseLine}
          />
        )}
        <Curve
          {...this.props}
          stroke="none"
          className="recharts-area-area"
        />
      </g>
    );
  }

  renderHorizontalRect(alpha) {
    const { baseLine, points, strokeWidth } = this.props;
    const startX = points[0].x;
    const endX = points[points.length - 1].x;
    const width = alpha * Math.abs(startX - endX);
    let maxY = Math.max.apply(null, points.map(entry => (entry.y || 0)));

    if (isNumber(baseLine)) {
      maxY = Math.max(baseLine, maxY);
    } else {
      maxY = Math.max(Math.max.apply(null, baseLine.map(entry => (entry.y || 0))), maxY);
    }

    return (
      <rect
        x={startX < endX ? startX : startX - width}
        y={0}
        width={width}
        height={maxY + (strokeWidth || 1)}
      />
    );
  }

  renderVerticalRect(alpha) {
    const { baseLine, points, strokeWidth } = this.props;
    const startY = points[0].y;
    const endY = points[points.length - 1].y;
    const height = alpha * Math.abs(startY - endY);
    let maxX = Math.max.apply(null, points.map(entry => (entry.x || 0)));

    if (isNumber(baseLine)) {
      maxX = Math.max(baseLine, maxX);
    } else {
      maxX = Math.max(Math.max.apply(null, baseLine.map(entry => (entry.x || 0))), maxX);
    }

    return (
      <rect
        x={0}
        y={startY < endY ? startY : startY - height}
        width={maxX + (strokeWidth || 1)}
        height={height}
      />
    );
  }

  renderClipRect(alpha) {
    const { layout } = this.props;

    if (layout === 'vertical') {
      return this.renderVerticalRect(alpha);
    }

    return this.renderHorizontalRect(alpha);
  }

  renderClipPath() {
    const { isAnimationActive, animationDuration, animationEasing,
      animationBegin, animationId } = this.props;

    return (
      <defs>
        <clipPath id={`animationClipPath-${this.id}`}>
          <Animate
            easing={animationEasing}
            isActive={isAnimationActive}
            duration={animationDuration}
            key={animationId}
            animationBegin={animationBegin}
            onAnimationStart={this.handleAnimationStart}
            onAnimationEnd={this.handleAnimationEnd}
            from={{ alpha: 0 }}
            to={{ alpha: 1 }}
          >
            {({ alpha }) => this.renderClipRect(alpha)}
          </Animate>
        </clipPath>
      </defs>
    );
  }

  renderDots() {
    const { isAnimationActive } = this.props;

    if (isAnimationActive && !this.state.isAnimationFinished) { return null; }

    const { dot, points } = this.props;
    const areaProps = getPresentationAttributes(this.props);
    const customDotProps = getPresentationAttributes(dot);

    const dots = points.map((entry, i) => {
      const dotProps = {
        key: `dot-${i}`,
        r: 3,
        ...areaProps,
        ...customDotProps,
        cx: entry.x,
        cy: entry.y,
        index: i,
        value: entry.value,
        payload: entry.payload,
      };

      return this.constructor.renderDotItem(dot, dotProps);
    });

    return <Layer className="recharts-area-dots">{dots}</Layer>;
  }

  render() {
    const { hide, dot, points, className, top, left, xAxis, yAxis,
      width, height, isAnimationActive } = this.props;

    if (hide || !points || !points.length) { return null; }

    const { isAnimationFinished } = this.state;
    const hasSinglePoint = points.length === 1;
    const layerClass = classNames('recharts-area', className);
    const needClip = (xAxis && xAxis.allowDataOverflow) || (yAxis && yAxis.allowDataOverflow);

    return (
      <Layer className={layerClass}>
        {needClip ? (
          <defs>
            <clipPath id={`clipPath-${this.id}`}>
              <rect x={left} y={top} width={width} height={height} />
            </clipPath>
          </defs>
        ) : null}
        {
          !hasSinglePoint ? this.renderClipPath() : null
        }
        {
          !hasSinglePoint ? (
            <Layer clipPath={needClip ? `url(#clipPath-${this.id})` : null}>
              <Layer clipPath={`url(#animationClipPath-${this.id})`}>
                {this.renderCurve()}
              </Layer>
            </Layer>
          ) : null
        }
        {(dot || hasSinglePoint) && this.renderDots()}
        {(!isAnimationActive || isAnimationFinished) &&
          LabelList.renderCallByParent(this.props, points)}
      </Layer>
    );
  }
}

export default Area;
