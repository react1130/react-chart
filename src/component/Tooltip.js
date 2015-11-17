import React, {PropTypes} from 'react';

const Tooltip = React.createClass({
  propTypes: {
    active: PropTypes.bool.isRequired,
    position: PropTypes.string,
    separator: PropTypes.string,
    formatter: PropTypes.func,
    itemStyle: PropTypes.object,
    labelStyle: PropTypes.object,
    style: PropTypes.object,
    mouseX: PropTypes.number,
    mouseY: PropTypes.number,
    coordinate: PropTypes.shape({
      x: PropTypes.number,
      y: PropTypes.number
    }),
    label: PropTypes.string,
    data: PropTypes.arrayOf(PropTypes.shape({
      key: PropTypes.any,
      value: PropTypes.number
    }))
  },

  getDefaultProps() {
    return {
      position: 'left-bottom',
      coordinate: {x: 0, y: 0},
      separator: ' : ',
      style: {},
      itemStyle: {},
      labelStyle: {},
      mouseX: 0,
      mouseY: 0
    };
  },
  getMargin () {
    let {position} = this.props;
    let ary = position.split('-');
    let orientH = ary[0];
    let orientV = ary[1];
    let result = {};

    if (orientH === 'right') {
      result.marginLeft = '-100%';
    }
    if (orientH === 'bottom') {
      result.marginTop = '-100%';
    }

    return result;
  },

  renderContent () {
    let {data, separator, formatter, itemStyle} = this.props;

    if (data && data.length) {
      let listStyle = {padding: 0, margin: 0};
      let items = data.map((entry, i) => {
        let finalItemStyle = {
          display: 'block',
          paddingTop: 4,
          paddingBottom: 4,
          color: entry.color || '#000',
          ...itemStyle
        };

        return (
          <li className='tooltip-item' key={'tooltip-item-' + i} style={finalItemStyle}>
            <span className='name'>{entry.key}</span>
            <span className='separator'>{separator}</span>
            <span className='value'>{formatter ? formatter(entry.value) : entry.value}</span>
          </li>
        );
      });

      return <ul className='tooltip-item-list' style={listStyle}>{items}</ul>;
    }
  },

  render() {
    let {mouseX, mouseY, coordinate, active, label, style, labelStyle} = this.props;
    let margin = this.getMargin();
    let wrapperStyle = {
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          padding: 10,
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: '#ccc',
          backgroundColor: '#fff',
          display: active ? 'block' : 'none',
          position: 'absolute',
          top: coordinate.y + 20,
          left: coordinate.x,
          ...style
        };
    let finalLabelStyle = {
      margin: 0,
      ...labelStyle
    };

    return (
      <div className='tooltip' style={wrapperStyle}>
        <p className='tooltip-label' style={finalLabelStyle}>{label}</p>
        {this.renderContent()}
      </div>
    );
  }
});

export default Tooltip;
