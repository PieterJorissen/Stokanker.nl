import { hasFlag, setFlag } from './flags.js';

export class Dialogue {
  constructor(tree, worldState, flags, onClose) {
    this.tree    = tree;
    this.world   = worldState;
    this.flags   = flags;
    this.onClose = onClose;
    this.node    = null;
  }

  start() { this._goto(this.tree.entry); }

  _goto(nodeId) {
    if (!nodeId || nodeId === 'end') { this.onClose(); return; }
    const node = this.tree.nodes[nodeId];
    if (!node) { this.onClose(); return; }
    this.node = node;

    if (node.flag) setFlag(node.flag);

    if (node.type === 'gate') {
      this._goto(this._check(node.condition) ? node.yes : node.no);
      return;
    }
    this._render(node);
  }

  _check(condition) {
    if (condition.flag)              return hasFlag(condition.flag);
    if (condition.buildingOpen)      return this.world.openBuildings.includes(condition.buildingOpen);
    if (condition.shipInPort)        return this.world.shipsInPort.includes(condition.shipInPort);
    if (condition.isWeekend != null) return this.world.isWeekend === condition.isWeekend;
    return true;
  }

  choose(index) { this._goto(this.node.choices[index].next); }

  _render(node) {
    document.dispatchEvent(new CustomEvent('dialogue-render', { detail: { node, engine: this } }));
  }
}
