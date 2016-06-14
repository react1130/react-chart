/**
 * @file TreemapChart
 */
import React, { Component, PropTypes } from 'react';
import Surface from '../container/Surface';
import Layer from '../container/Layer';
import Tooltip from '../component/Tooltip';
import Rectangle from '../shape/Rectangle';
import classNames from 'classnames';
import pureRender from '../util/PureRender';
import { findChildByType, validateWidthHeight, filterSvgElements } from '../util/ReactUtils';
import _ from 'lodash';

const number = (a, b) => {
  const ka = +a;
  const kb = b - ka;
  return t => ka + kb * t;
};

const center = (node) => (node.y + node.dy / 2);

const value = (link) => link.value;

const nest = (nodes) => {
  const nestNodes = [];

  nodes.map((node) => {
    for (let i = 0; i < nestNodes.length; i++) {
      if (nestNodes[i].key === node.x) {
        nestNodes[i].values.push(node);
        return null;
      }
    }
    nestNodes.push({
      key: node.x,
      values: [node],
    });
    return null;
  });

  nestNodes.sort((a, b) => {
    if (a.key < b.key) {
      return -1;
    } else if (a.key > b.key) {
      return 1;
    }
    return 0;
  });

  return nestNodes.map((d) => (d.values));
};

const computeNodeLinks = (nodes, links) => {
  nodes.forEach((node) => {
    node.sourceLinks = [];
    node.targetLinks = [];
  });
  links.forEach((link) => {
    let source = link.source;
    let target = link.target;
    if (typeof source === 'number') {
      source = link.source = nodes[link.source];
    }
    if (typeof target === 'number') {
      target = link.target = nodes[link.target];
    }
    source.sourceLinks.push(link);
    target.targetLinks.push(link);
  });
};

const computeNodeValues = (nodes) => {
  nodes.forEach((node) => {
    node.value = Math.max(
      _.sumBy(node.sourceLinks, value),
      _.sumBy(node.targetLinks, value)
    );
  });
};

const moveSinksRight = (x, nodes) => {
  nodes.forEach((node) => {
    if (!node.sourceLinks.length) {
      node.x = x - 1;
    }
  });
};

const scaleNodeBreadths = (kx, nodes) => {
  nodes.forEach((node) => {
    node.x *= kx;
  });
};

const computeNodeBreadths = (nodes, links, size, nodeWidth) => {
  let remainingNodes = nodes;
  let nextNodes;
  let x = 0;


  while (remainingNodes.length) {
    nextNodes = [];
    remainingNodes.forEach((node) => {
      node.x = x;
      node.dx = nodeWidth;
      node.sourceLinks.forEach((link) => {
        if (nextNodes.indexOf(link.target) < 0) {
          nextNodes.push(link.target);
        }
      });
    });
    remainingNodes = nextNodes;
    ++x;
  }

  moveSinksRight(x, nodes);
  scaleNodeBreadths((size[0] - nodeWidth) / (x - 1), nodes);
};

const computeNodeDepths = (iterations, nodes, links, size, nodePadding) => {
  const nodesByBreadth = nest(nodes);

  const initializeNodeDepth = () => {
    const ky = _.min(nodesByBreadth.map((nodes) => {
      return (size[1] - (nodes.length - 1) * nodePadding) / _.sumBy(nodes, value);
    }));

    nodesByBreadth.forEach((nodes) => {
      nodes.forEach((node, i) => {
        node.y = i;
        node.dy = node.value * ky;
      });
    });

    links.forEach((link) => {
      link.dy = link.value * ky;
    });
  };

  function relaxLeftToRight(alpha) {
    function weightedSource(link) {
      return center(link.source) * link.value;
    }
    nodesByBreadth.forEach((nodes, breadth) => {
      nodes.forEach((node) => {
        if (node.targetLinks.length) {
          var y = _.sumBy(node.targetLinks, weightedSource) / _.sumBy(node.targetLinks, value);
          node.y += (y - center(node)) * alpha;
        }
      });
    });

  }

  function relaxRightToLeft(alpha) {
    function weightedTarget(link) {
      return center(link.target) * link.value;
    }

    nodesByBreadth.slice().reverse().forEach((nodes) => {
      nodes.forEach((node) => {
        if (node.sourceLinks.length) {
          var y = _.sumBy(node.sourceLinks, weightedTarget) / _.sumBy(node.sourceLinks, value);
          node.y += (y - center(node)) * alpha;
        }
      });
    });

  }

  function ascendingDepth(a, b) {
    return a.y - b.y;
  }

  function resolveCollisions() {
    nodesByBreadth.forEach((nodes) => {
      let node;
      let dy;
      let y0 = 0;
      const n = nodes.length;
      let i;

      // Push any overlapping nodes down.
      nodes.sort(ascendingDepth);
      for (i = 0; i < n; ++i) {
        node = nodes[i];
        dy = y0 - node.y;
        if (dy > 0) node.y += dy;
        y0 = node.y + node.dy + nodePadding;
      }

      // If the bottommost node goes outside the bounds, push it back up.
      dy = y0 - nodePadding - size[1];
      if (dy > 0) {
        y0 = node.y -= dy;

        // Push any overlapping nodes back up.
        for (i = n - 2; i >= 0; --i) {
          node = nodes[i];
          dy = node.y + node.dy + nodePadding - y0;
          if (dy > 0) node.y -= dy;
          y0 = node.y;
        }
      }
    });
  }

  initializeNodeDepth();
  resolveCollisions();
  for (var alpha = 1; iterations > 0; --iterations) {
    relaxRightToLeft(alpha *= 0.99);
    resolveCollisions();
    relaxLeftToRight(alpha);
    resolveCollisions();
  }
};

function computeLinkDepths(nodes) {
  function ascendingSourceDepth(a, b) {
    return a.source.y - b.source.y;
  }

  function ascendingTargetDepth(a, b) {
    return a.target.y - b.target.y;
  }

  nodes.forEach((node) => {
    node.sourceLinks.sort(ascendingTargetDepth);
    node.targetLinks.sort(ascendingSourceDepth);
  });
  nodes.forEach((node) => {
    let sy = 0;
    let ty = 0;
    node.sourceLinks.forEach((link) => {
      link.sy = sy;
      sy += link.dy;
    });
    node.targetLinks.forEach((link) => {
      link.ty = ty;
      ty += link.dy;
    });
  });
}


const computeData = (data, size, iterations, nodeWidth, nodePadding) => {
  const { nodes, links } = data;

  computeNodeLinks(nodes, links);
  computeNodeValues(nodes);
  computeNodeBreadths(nodes, links, size, nodeWidth);
  computeNodeDepths(iterations, nodes, links, size, nodePadding);
  computeLinkDepths(nodes);

  return data;
};


@pureRender
class Sankey extends Component {
  static displayName = 'Sankey';

  static propTypes = {
    width: PropTypes.number,
    height: PropTypes.number,
    data: PropTypes.object,
    nodePadding: PropTypes.number,
    nodeWidth: PropTypes.number,
    linkCurvature: PropTypes.number,
    iterations: PropTypes.number,
    nodeContent: PropTypes.oneOfType([PropTypes.element, PropTypes.func]),
    linkContent: PropTypes.oneOfType([PropTypes.element, PropTypes.func]),
    style: PropTypes.object,
    className: PropTypes.string,
    children: PropTypes.oneOfType([
      PropTypes.arrayOf(PropTypes.node),
      PropTypes.node,
    ]),

    onMouseEnter: PropTypes.func,
    onMouseLeave: PropTypes.func,
    onClick: PropTypes.func,
  };

  static defaultProps = {
    nodePadding: 10,
    nodeWidth: 10,
    linkCurvature: 0.5,
    iterations: 32,
  }

  state = {
    isTooltipActive: false,
  }

  handleMouseEnter = (e) => {
    const { onMouseEnter, children } = this.props;
    const tooltipItem = findChildByType(children, Tooltip);

    if (tooltipItem) {
      this.setState({
        isTooltipActive: true,
      }, () => {
        if (onMouseEnter) {
          onMouseEnter(e);
        }
      });
    } else if (onMouseEnter) {
      onMouseEnter(e);
    }
  };

  handleMouseLeave = (e) => {
    const { onMouseLeave, children } = this.props;
    const tooltipItem = findChildByType(children, Tooltip);

    if (tooltipItem) {
      this.setState({
        isTooltipActive: false,
      }, () => {
        if (onMouseLeave) {
          onMouseLeave(e);
        }
      });
    } else if (onMouseLeave) {
      onMouseLeave(e);
    }
  };

  handleClick() {
    const { onClick } = this.props;

    if (onClick) {
      onClick();
    }
  }

  renderLinks(links) {
    const { linkCurvature, linkContent } = this.props;

    return (
      <Layer>
        {
          links.map((link, i) => {
            const { sy: sourceRelativeY, ty: targetRelativeY, dy: linkWidth } = link;

            const sourceX = link.source.x + link.source.dx;
            const targetX = link.target.x;

            const interpolationFunc = number(sourceX, targetX);
            const sourceControlX = interpolationFunc(linkCurvature);
            const targetControlX = interpolationFunc(1 - linkCurvature);

            const sourceY = link.source.y + sourceRelativeY + linkWidth / 2;
            const targetY = link.target.y + targetRelativeY + linkWidth / 2;


            const linkProps = {
              sourceX, targetX,
              sourceY, targetY,
              sourceControlX, targetControlX,
              sourceRelativeY, targetRelativeY,
              linkWidth,
              index: i,
              link,
            };

            if (React.isValidElement(linkContent)) {
              return React.cloneElement(linkContent, linkProps);
            } else if (_.isFunction(linkContent)) {
              return linkContent(linkProps);
            }

            return (
              <Layer
                key={`link${i}`}
                onMouseLeave={this.handleMouseLeave}
                onMouseEnter={this.handleMouseEnter}
              >
                <path
                  className="recharts-sankey-link"
                  d={`
                    M${sourceX},${sourceY}
                    C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}
                  `}
                  fill="none"
                  stroke="#333"
                  strokeWidth={linkWidth}
                  strokeOpacity="0.2"
                />
              </Layer>
            );
          })
        }
      </Layer>
    );
  }

  renderNodes(nodes) {
    const { nodeContent } = this.props;

    return (
      <Layer>
        {
          nodes.map((node, i) => {
            const { x, y, dx, dy } = node;

            const nodeProps = {
              x,
              y,
              width: dx,
              height: dy,
              index: i,
              node,
            };

            if (React.isValidElement(nodeContent)) {
              return React.cloneElement(nodeContent, nodeProps);
            } else if (_.isFunction(nodeContent)) {
              return nodeContent(nodeProps);
            }

            return (
              <Rectangle
                className="recharts-sankey-node"
                key={`node${i}`}
                {...nodeProps}
                fill="#0088fe"
                fillOpacity="0.8"
              />
            );
          })
        }
      </Layer>
    );
  }

  renderTooltip() {
    const { children } = this.props;
    const tooltipItem = findChildByType(children, Tooltip);

    if (!tooltipItem) { return null; }

    const { isTooltipActive } = this.state;
    const viewBox = { x: 0, y: 0, width: 100, height: 100 };
    const coordinate = {
      x: 0,
      y: 0,
    };
    const payload = isTooltipActive ? [{
      name: 'hh', value: 'aa',
    }] : [];

    return React.cloneElement(tooltipItem, {
      viewBox,
      active: isTooltipActive,
      coordinate,
      label: 'bb',
      payload,
      separator: 'cc',
    });
  }

  render() {
    if (!validateWidthHeight(this)) { return null; }

    const { data,
      iterations, nodeWidth, nodePadding,
      width, height,
      className, style, children,
    } = this.props;
    const size = [width, height];
    const { nodes, links } = computeData(
      _.cloneDeep(data), size, iterations, nodeWidth, nodePadding
    );

    return (
      <div
        className={classNames('recharts-wrapper', className)}
        style={{ position: 'relative', cursor: 'default', ...style }}
      >
        <Surface width={width} height={height}>
          {filterSvgElements(children)}
          {this.renderLinks(links)}
          {this.renderNodes(nodes)}
        </Surface>
        {this.renderTooltip()}
      </div>
    );
  }
}

export default Sankey;
